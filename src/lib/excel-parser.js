import ExcelJS from 'exceljs';
import prisma from './prisma';

// Helper to process promises in chunks to prevent DB connection pool exhaustion
async function runInChunks(items, chunkSize, asyncCallback) {
    const results = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(asyncCallback));
        results.push(...chunkResults);
    }
    return results;
}

export async function parseAndImport(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    let importedUsers = 0;
    let importedGames = 0;

    // ==================================================
    // 0. DATE & CYCLE PREPARATION
    // ==================================================
    const memberSheet = workbook.getWorksheet('Union Member Statistics');
    const mttSheet = workbook.getWorksheet('Union MTT Detail');

    if (!memberSheet) throw new Error("Sheet 'Union Member Statistics' not found.");

    // Extract Date from Row 1
    const dateCell = memberSheet.getCell('A1').value;
    let sessionDate = new Date();
    if (dateCell) {
        const dateStr = dateCell.toString().split(' ')[0];
        const parsed = new Date(dateStr);
        if (!isNaN(parsed)) sessionDate = parsed;
    }

    const dateStart = new Date(sessionDate); dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(sessionDate); dateEnd.setHours(23, 59, 59, 999);

    // Ensure Cycle Exists
    let currentCycle = await prisma.cycle.findFirst({
        where: { status: 'OPEN' },
        orderBy: { startDate: 'desc' }
    });

    if (!currentCycle) {
        currentCycle = await prisma.cycle.create({
            data: { status: 'OPEN' }
        });
    }

    // ==================================================
    // 1. IMPORT USERS & SUMMARY SESSIONS (Union Member Statistics)
    // ==================================================
    const uniqueUsers = new Map(); // Key: Code, Value: { ...data }
    const memberSessions = []; // To hold cash game sessions (Total - MTT)

    let currentClubId = null;
    let currentClubName = null;

    memberSheet.eachRow((row, rowNumber) => {
        if (rowNumber < 7) return;

        // Extract Club Info
        const cellValA = row.getCell(1).value?.toString() || "";
        const cellValB = row.getCell(2).value?.toString() || "";
        const clubMatchA = cellValA.match(/(.*?)\s*\(ID:(\d+)\)/);
        const clubMatchB = cellValB.match(/(.*?)\s*\(ID:(\d+)\)/);

        if (clubMatchA) {
            currentClubName = clubMatchA[1].trim();
            currentClubId = clubMatchA[2];
        } else if (clubMatchB) {
            currentClubName = clubMatchB[1].trim();
            currentClubId = clubMatchB[2];
        }

        const saId = row.getCell(3).value?.toString()?.trim();
        const saName = row.getCell(4).value?.toString()?.trim();
        const agentId = row.getCell(5).value?.toString()?.trim();
        const agentName = row.getCell(6).value?.toString()?.trim();
        const playerId = row.getCell(9).value?.toString()?.trim();
        const playerName = row.getCell(10).value?.toString()?.trim();

        // Skip summary/total rows
        if (playerName?.toLowerCase() === 'total' || saName?.toLowerCase() === 'total' || agentName?.toLowerCase() === 'total') return;

        const setIfNew = (code, name, role, parentCode, superAgentCode) => {
            if (!code || code === '-' || code === '0' || code.toLowerCase() === 'total') return;
            const existing = uniqueUsers.get(code);
            if (!existing || currentClubId) {
                uniqueUsers.set(code, {
                    code,
                    name: name || existing?.name,
                    role,
                    parentCode: parentCode || existing?.parentCode,
                    superAgentCode: superAgentCode || existing?.superAgentCode,
                    clubId: currentClubId || existing?.clubId,
                    clubName: currentClubName || existing?.clubName
                });
            }
        };

        setIfNew(saId, saName, 'SUPER_AGENT', null, null);
        setIfNew(agentId, agentName, 'AGENT', saId !== '-' ? saId : null, saId !== '-' ? saId : null);
        setIfNew(playerId, playerName, 'PLAYER', agentId, saId !== '-' ? saId : null);

        // Extract Session Data (Cash Games = Total - MTT)
        if (playerId && playerId !== '-' && playerId.toLowerCase() !== 'total') {
            const totalPnl = parseFloat(row.getCell(38).value || 0);
            const mttPnl = parseFloat(row.getCell(30).value || 0); // Player P&L > MTT > Total
            const totalRake = parseFloat(row.getCell(65).value || 0);
            const mttRake = parseFloat(row.getCell(57).value || 0); // Rake&Fee > MTT > Total

            const cashPnl = totalPnl - mttPnl;
            const cashRake = totalRake - mttRake;

            if (cashPnl !== 0 || cashRake !== 0) {
                memberSessions.push({
                    userCode: playerId,
                    pnl: cashPnl,
                    rake: cashRake,
                    tableName: 'Cash Games',
                    hands: parseInt(row.getCell(152).value || 0) - parseInt(row.getCell(144).value || 0) // Total Hands - MTT Hands
                });
            }
        }
    });

    // Bulk Sync Users (Same logic as before)
    const allUserCodes = Array.from(uniqueUsers.keys());
    const existingUsers = await prisma.user.findMany({
        where: { code: { in: allUserCodes } },
        select: { id: true, code: true }
    });
    const existingUserMap = new Map(existingUsers.map(u => [u.code, u.id]));

    const usersToCreate = [];
    for (const [code, data] of uniqueUsers) {
        if (!existingUserMap.has(code)) usersToCreate.push(data);
    }

    if (usersToCreate.length > 0) {
        await prisma.user.createMany({
            data: usersToCreate.map(u => ({
                code: u.code,
                name: u.name,
                role: u.role,
                clubId: u.clubId,
                clubName: u.clubName
            })),
            skipDuplicates: true
        });
        importedUsers += usersToCreate.length;
    }

    //建立 Hierarchy
    const finalUserFetch = await prisma.user.findMany({
        where: { code: { in: allUserCodes } },
        select: { id: true, code: true }
    });
    const codeToId = new Map(finalUserFetch.map(u => [u.code, u.id]));

    const updatePromises = Array.from(uniqueUsers.values()).map(u => {
        const dbId = codeToId.get(u.code);
        const parentId = u.parentCode ? codeToId.get(u.parentCode) : null;
        const saId = u.superAgentCode ? codeToId.get(u.superAgentCode) : null;

        // Note: managerId is not extracted from Excel currently
        // Managers need to be assigned manually or through a separate process
        // The managerId field will be preserved if it already exists in the database
        
        return prisma.user.update({
            where: { id: dbId },
            data: {
                name: u.name,
                clubId: u.clubId,
                clubName: u.clubName,
                agentId: (u.role === 'PLAYER' && parentId) ? parentId : undefined,
                superAgentId: (u.role === 'AGENT' && parentId) ? parentId : (saId || undefined)
                // managerId is not updated here - preserve existing value
            }
        });
    });
    await runInChunks(updatePromises, 50, (p) => p);

    // ==================================================
    // 2. IMPORT MTT SESSIONS (Union MTT Detail)
    // ==================================================
    const mttSessions = [];
    if (mttSheet) {
        let currentTournament = 'Tournament';
        mttSheet.eachRow((row, rowNumber) => {
            const cellA = row.getCell(1).value?.toString();
            if (cellA && cellA.includes('Table Name :')) {
                currentTournament = cellA.split(',')[0].replace('Table Name :', '').trim();
                return;
            }
            if (rowNumber < 8) return;

            const playerNickname = row.getCell(4).value?.toString()?.toLowerCase();
            if (playerNickname === 'total' || !playerNickname) return;

            const playerId = row.getCell(3).value?.toString()?.trim();
            const pnl = parseFloat(row.getCell(17).value || 0);

            // Rake: Sum of Fee (7, 8, 11, 12)
            const rake = (parseFloat(row.getCell(7).value) || 0) +
                (parseFloat(row.getCell(8).value) || 0) +
                (parseFloat(row.getCell(11).value) || 0) +
                (parseFloat(row.getCell(12).value) || 0);

            if (playerId && (pnl !== 0 || rake !== 0)) {
                mttSessions.push({
                    userCode: playerId,
                    pnl,
                    rake,
                    tableName: currentTournament,
                    hands: parseInt(row.getCell(13).value || 0)
                });
            }
        });
    }

    // ==================================================
    // 3. UNIFIED SESSION SAVING & BALANCE REVERT
    // ==================================================
    const allSessions = [...memberSessions, ...mttSessions];

    // Revert existing sessions for this date
    const sessionsToDelete = await prisma.gameSession.groupBy({
        by: ['userId'],
        where: { date: { gte: dateStart, lte: dateEnd } },
        _sum: { pnl: true }
    });

    await runInChunks(sessionsToDelete, 50, async (group) => {
        if (group._sum.pnl) {
            await prisma.user.update({
                where: { id: group.userId },
                data: { balance: { decrement: group._sum.pnl } }
            });
        }
    });

    await prisma.gameSession.deleteMany({
        where: { date: { gte: dateStart, lte: dateEnd } }
    });

    // Insert new sessions
    const sessionsToInsert = [];
    const userBalanceUpdates = {};

    for (const session of allSessions) {
        const dbUserId = codeToId.get(session.userCode);
        if (dbUserId) {
            sessionsToInsert.push({
                userId: dbUserId,
                date: sessionDate,
                tableName: session.tableName,
                buyIn: 0, // Not explicitly tracked in summary
                cashOut: 0,
                pnl: session.pnl,
                hands: session.hands,
                rake: session.rake,
                cycleId: currentCycle.id
            });

            if (!userBalanceUpdates[dbUserId]) userBalanceUpdates[dbUserId] = 0;
            userBalanceUpdates[dbUserId] += session.pnl;
        }
    }

    if (sessionsToInsert.length > 0) {
        await prisma.gameSession.createMany({ data: sessionsToInsert });
        importedGames = sessionsToInsert.length;
    }

    // Update balances
    const balanceUpdatesArray = Object.entries(userBalanceUpdates).map(([userId, netPnl]) => ({ userId, netPnl }));
    await runInChunks(balanceUpdatesArray, 50, async (item) => {
        if (item.netPnl !== 0) {
            await prisma.user.update({
                where: { id: item.userId },
                data: { balance: { increment: item.netPnl } }
            });
        }
    });

    // Log success
    try {
        await prisma.importLog.create({
            data: {
                fileName: "Excel Upload",
                periodStart: dateStart,
                periodEnd: dateEnd,
                status: "SUCCESS"
            }
        });
    } catch (e) { console.error("Failed to create ImportLog", e); }

    return { users: importedUsers, games: importedGames };
}
