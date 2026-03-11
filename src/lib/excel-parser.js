import ExcelJS from 'exceljs';
import prisma from './prisma';

/**
 * Column mappings for Union Member Statistics sheet
 * Based on header rows 4-6
 */
const MEMBER_COLS = {
    CLUB: 1,              // Club name with ID: "Club Name (ID:123456)"
    SUPER_AGENT_ID: 3,    // Super Agent ID
    SUPER_AGENT_NAME: 4,  // Super Agent Nickname
    AGENT_ID: 5,          // Agent ID
    AGENT_NAME: 6,        // Agent Nickname
    ROLE: 8,              // Role (Player, Agent, etc.)
    MEMBER_ID: 9,         // Member ID (player code)
    MEMBER_NAME: 10,      // Member Nickname
    TOTAL_PNL: 38,        // Player P&L > Total
    TOTAL_RAKE: 65,       // Rake&Fee > Total
};

/**
 * Column mappings for Union MTT Detail sheet
 * Based on header rows 5-7
 */
const MTT_COLS = {
    PLAYER_ID: 3,         // Player ID
    PLAYER_NAME: 4,       // Player Nickname
    BUYIN_FEE_CHIPS: 7,   // Total Buy-in > Fee > Chips
    BUYIN_FEE_TICKET: 8,  // Total Buy-in > Fee > Ticket
    REENTRY_FEE_CHIPS: 11, // Total Re-Entry > Fee > Chips
    REENTRY_FEE_TICKET: 12, // Total Re-Entry > Fee > Ticket
    HANDS: 13,            // Hands
    PNL: 17,              // P&L
};

/**
 * Column mappings for Union Ring Game Detail sheet.
 * Layout: Row 3 = "Table Name : ...", Rows 5–6 = headers (Club, Player, Buy-in, Cashout), Row 7+ = data.
 * Data columns: 3 = Player ID, 4 = Nickname, 5 = Buy-in, 6 = Cashout, 7 = Hands.
 */
const RING_COLS = {
    MEMBER_ID: 3,   // Player ID (player code)
    NICKNAME: 4,    // Skip "Total" rows when this is "Total"
    BUYIN: 5,
    CASHOUT: 6,
    HANDS: 7,
};

const DATA_START_ROW = 7; // First data row in Member Statistics
const MTT_DATA_START_ROW = 8; // First data row in MTT Detail

/**
 * Parse club info from cell value like "Club Name (ID:123456)"
 */
function parseClubInfo(cellValue) {
    if (!cellValue) return null;
    const match = String(cellValue).match(/^(.+?)\s*\(ID:(\d+)\)$/);
    if (match) {
        return { name: match[1].trim(), id: match[2] };
    }
    return null;
}

/**
 * Safely get numeric value from cell
 */
function getNumber(row, col) {
    const val = row.getCell(col).value;
    if (val === null || val === undefined || val === '') return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
}

/**
 * Safely get string value from cell
 */
function getString(row, col) {
    const val = row.getCell(col).value;
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    return (str === '' || str === '-' || str === '0') ? null : str;
}

/**
 * Check if row is a summary/total row that should be skipped
 */
function isTotalRow(row) {
    const name = getString(row, MEMBER_COLS.MEMBER_NAME);
    const agentName = getString(row, MEMBER_COLS.AGENT_NAME);
    const saName = getString(row, MEMBER_COLS.SUPER_AGENT_NAME);
    
    return (name?.toLowerCase() === 'total' || 
            agentName?.toLowerCase() === 'total' || 
            saName?.toLowerCase() === 'total');
}

/**
 * Extract date from the sheet header
 */
function extractDateFromSheet(sheet) {
    // Try row 3 first (Period row), then row 1
    for (const rowNum of [3, 1]) {
        const cellValue = sheet.getCell(rowNum, 1).value;
        if (cellValue) {
            const str = String(cellValue);
            // Look for date pattern like "2025-08-07"
            const dateMatch = str.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                const parsed = new Date(dateMatch[1]);
                if (!isNaN(parsed.getTime())) return parsed;
            }
        }
    }
    return new Date();
}

/**
 * Parse Union Member Statistics sheet.
 * Returns users and ring-game totals only (no sessions). Totals are used for cycle winnings/rake.
 */
function parseMemberStatistics(sheet) {
    const users = new Map();
    const ringTotals = [];
    let currentClub = null;

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber < DATA_START_ROW) return;
        if (isTotalRow(row)) return;

        const clubInfo = parseClubInfo(row.getCell(MEMBER_COLS.CLUB).value);
        if (clubInfo) currentClub = clubInfo;

        const superAgentId = getString(row, MEMBER_COLS.SUPER_AGENT_ID);
        const superAgentName = getString(row, MEMBER_COLS.SUPER_AGENT_NAME);
        const agentId = getString(row, MEMBER_COLS.AGENT_ID);
        const agentName = getString(row, MEMBER_COLS.AGENT_NAME);
        const memberId = getString(row, MEMBER_COLS.MEMBER_ID);
        const memberName = getString(row, MEMBER_COLS.MEMBER_NAME);

        if (superAgentId && !users.has(superAgentId)) {
            users.set(superAgentId, {
                code: superAgentId,
                name: superAgentName,
                role: 'SUPER_AGENT',
                agentCode: null,
                superAgentCode: null,
                clubId: currentClub?.id,
                clubName: currentClub?.name,
            });
        }

        if (agentId && !users.has(agentId)) {
            users.set(agentId, {
                code: agentId,
                name: agentName,
                role: 'AGENT',
                agentCode: null,
                superAgentCode: superAgentId,
                clubId: currentClub?.id,
                clubName: currentClub?.name,
            });
        }

        if (memberId) {
            const existing = users.get(memberId);
            if (!existing || currentClub) {
                users.set(memberId, {
                    code: memberId,
                    name: memberName || existing?.name,
                    role: 'PLAYER',
                    agentCode: agentId,
                    superAgentCode: superAgentId,
                    clubId: currentClub?.id || existing?.clubId,
                    clubName: currentClub?.name || existing?.clubName,
                });
            }

            const totalPnl = getNumber(row, MEMBER_COLS.TOTAL_PNL);
            const totalRake = getNumber(row, MEMBER_COLS.TOTAL_RAKE);
            if (totalPnl !== 0 || totalRake !== 0) {
                ringTotals.push({ userCode: memberId, totalPnl, totalRake });
            }
        }
    });

    return { users, ringTotals };
}

/**
 * Parse Union Ring Game Detail sheet.
 * Structure: repeated blocks of "Table Name" row (row 3, 12, …), "Table Information", two header rows, data rows, "Total" row.
 * Returns session rows: date and table name from header, buy-in and cash-out per row.
 */
function parseRingGameDetail(sheet, sessionDate) {
    if (!sheet) return [];
    const sessions = [];
    let currentTableName = 'Ring Game';

    sheet.eachRow((row) => {
        const col1 = String(row.getCell(1).value || '').trim();
        const memberId = getString(row, RING_COLS.MEMBER_ID);
        const nickname = getString(row, RING_COLS.NICKNAME);

        if (col1.includes('Table Name')) {
            const match = col1.match(/Table Name\s*:\s*([^,]+)/i);
            if (match) currentTableName = match[1].trim();
            return;
        }
        if (col1.includes('Table Information') || col1.includes('Start/End Time')) return;
        if (memberId === 'Player' || memberId === 'ID' || getString(row, RING_COLS.BUYIN) === 'Buy-in') return;
        if (!memberId || memberId === '-' || nickname?.toLowerCase() === 'total' || memberId === 'Total') return;

        const buyIn = getNumber(row, RING_COLS.BUYIN);
        const cashOut = getNumber(row, RING_COLS.CASHOUT);
        const hands = Math.floor(getNumber(row, RING_COLS.HANDS));
        const pnl = cashOut - buyIn;

        sessions.push({
            userCode: memberId,
            date: sessionDate,
            tableName: currentTableName,
            buyIn,
            cashOut,
            pnl,
            rake: 0,
            hands,
        });
    });

    return sessions;
}

/**
 * Parse Union MTT Detail sheet
 * Returns: Array<sessionData>
 */
function parseMTTDetail(sheet) {
    if (!sheet) return [];
    
    const sessions = [];
    let currentTableName = 'Tournament';

    sheet.eachRow((row, rowNumber) => {
        // Check for table name header
        const col1 = String(row.getCell(1).value || '');
        if (col1.includes('Table Name')) {
            // Extract table name: "Table Name : DAILY GIFT FREEROLL , Creator : ..."
            const match = col1.match(/Table Name\s*:\s*([^,]+)/i);
            if (match) {
                currentTableName = match[1].trim();
            }
            return;
        }

        if (rowNumber < MTT_DATA_START_ROW) return;

        const playerId = getString(row, MTT_COLS.PLAYER_ID);
        const playerName = getString(row, MTT_COLS.PLAYER_NAME);

        // Skip total rows and empty rows
        if (!playerId || playerName?.toLowerCase() === 'total') return;

        const pnl = getNumber(row, MTT_COLS.PNL);
        
        // Rake = sum of all fee columns (chips + ticket for both buy-in and re-entry)
        const rake = getNumber(row, MTT_COLS.BUYIN_FEE_CHIPS) +
                     getNumber(row, MTT_COLS.BUYIN_FEE_TICKET) +
                     getNumber(row, MTT_COLS.REENTRY_FEE_CHIPS) +
                     getNumber(row, MTT_COLS.REENTRY_FEE_TICKET);
        
        const hands = getNumber(row, MTT_COLS.HANDS);

        if (pnl !== 0 || rake !== 0) {
            sessions.push({
                userCode: playerId,
                pnl,
                rake,
                tableName: currentTableName,
                hands: Math.floor(hands),
            });
        }
    });

    return sessions;
}

const GAME_TYPE_RING = 'RING';
const GAME_TYPE_MTT = 'MTT';

/**
 * Batch database operations in chunks to prevent connection pool exhaustion
 */
async function batchOperation(items, batchSize, operation) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(operation));
        results.push(...batchResults);
    }
    return results;
}

/**
 * Main import function
 */
export async function parseAndImport(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const memberSheet = workbook.getWorksheet('Union Member Statistics');
    const ringSheet = workbook.getWorksheet('Union Ring Game Detail');
    const mttSheet = workbook.getWorksheet('Union MTT Detail');

    if (!memberSheet) {
        throw new Error("Sheet 'Union Member Statistics' not found.");
    }

    const sessionDate = extractDateFromSheet(memberSheet);
    const dateStart = new Date(sessionDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(sessionDate);
    dateEnd.setHours(23, 59, 59, 999);

    let currentCycle = await prisma.cycle.findFirst({
        where: { status: 'OPEN' },
        orderBy: { startDate: 'desc' }
    });

    if (!currentCycle) {
        currentCycle = await prisma.cycle.create({
            data: { status: 'OPEN' }
        });
    }

    // ========================================
    // 1. Parse Excel Data
    // ========================================
    const { users, ringTotals } = parseMemberStatistics(memberSheet);
    const ringSessions = parseRingGameDetail(ringSheet, sessionDate);
    const mttSessions = parseMTTDetail(mttSheet);

    // ========================================
    // 2. Sync Users to Database
    // ========================================
    // Filter out placeholder codes like "-" that should not become real users
    const allUserCodes = Array.from(users.keys()).filter(code => code && code !== '-');
    
    // Fetch existing users
    const existingUsers = await prisma.user.findMany({
        where: { code: { in: allUserCodes } },
        select: { id: true, code: true }
    });
    const existingUserMap = new Map(existingUsers.map(u => [u.code, u.id]));

    // Create new users
    const usersToCreate = [];
    for (const [code, data] of users) {
        // Extra safety: never create users for placeholder "-" codes
        if (!code || code === '-') continue;

        if (!existingUserMap.has(code)) {
            usersToCreate.push({
                code: data.code,
                name: data.name,
                role: data.role,
                clubId: data.clubId,
                clubName: data.clubName,
            });
        }
    }

    let importedUsers = 0;
    if (usersToCreate.length > 0) {
        await prisma.user.createMany({
            data: usersToCreate,
            skipDuplicates: true,
        });
        importedUsers = usersToCreate.length;
    }

    // Refresh user map with all users (including newly created)
    const allDbUsers = await prisma.user.findMany({
        where: { code: { in: allUserCodes } },
        select: { id: true, code: true }
    });
    const codeToId = new Map(allDbUsers.map(u => [u.code, u.id]));

    // Update user hierarchy relationships
    const userUpdates = Array.from(users.values()).map(userData => {
        const userId = codeToId.get(userData.code);
        if (!userId) return null;

        const agentId = userData.agentCode ? codeToId.get(userData.agentCode) : null;
        const superAgentId = userData.superAgentCode ? codeToId.get(userData.superAgentCode) : null;

        return prisma.user.update({
            where: { id: userId },
            data: {
                name: userData.name,
                clubId: userData.clubId,
                clubName: userData.clubName,
                agentId: userData.role === 'PLAYER' ? agentId : undefined,
                superAgentId: userData.role === 'AGENT' ? superAgentId : 
                              (userData.role === 'PLAYER' ? superAgentId : undefined),
            }
        });
    }).filter(Boolean);

    await batchOperation(userUpdates, 50, p => p);

    // ========================================
    // 3. Save Ring Totals (from Union Member Statistics)
    // ========================================
    await prisma.playerRingTotal.deleteMany({
        where: {
            cycleId: currentCycle.id,
            periodDate: { gte: dateStart, lte: dateEnd }
        }
    });

    const ringTotalsToInsert = ringTotals
        .filter(r => codeToId.has(r.userCode))
        .map(r => ({
            userId: codeToId.get(r.userCode),
            cycleId: currentCycle.id,
            periodDate: sessionDate,
            totalPnl: r.totalPnl,
            totalRake: r.totalRake,
        }));

    if (ringTotalsToInsert.length > 0) {
        await prisma.playerRingTotal.createMany({ data: ringTotalsToInsert });
    }

    // ========================================
    // 4. Save Game Sessions (Ring from Union Ring Game Detail, MTT from Union MTT Detail)
    // Only remove sessions for this cycle + date so re-upload replaces this period; closed cycles are untouched.
    // ========================================
    await prisma.gameSession.deleteMany({
        where: {
            cycleId: currentCycle.id,
            date: { gte: dateStart, lte: dateEnd }
        }
    });

    const ringSessionsToInsert = ringSessions
        .filter(s => codeToId.has(s.userCode))
        .map(s => ({
            userId: codeToId.get(s.userCode),
            date: s.date,
            tableName: s.tableName,
            gameType: GAME_TYPE_RING,
            buyIn: s.buyIn,
            cashOut: s.cashOut,
            pnl: s.pnl,
            rake: s.rake,
            hands: s.hands,
            cycleId: currentCycle.id,
        }));

    const mttSessionsToInsert = mttSessions
        .filter(s => codeToId.has(s.userCode))
        .map(s => ({
            userId: codeToId.get(s.userCode),
            date: sessionDate,
            tableName: s.tableName,
            gameType: GAME_TYPE_MTT,
            buyIn: 0,
            cashOut: 0,
            pnl: s.pnl,
            rake: s.rake,
            hands: s.hands,
            cycleId: currentCycle.id,
        }));

    let importedGames = 0;
    if (ringSessionsToInsert.length > 0) {
        await prisma.gameSession.createMany({ data: ringSessionsToInsert });
        importedGames += ringSessionsToInsert.length;
    }
    if (mttSessionsToInsert.length > 0) {
        await prisma.gameSession.createMany({ data: mttSessionsToInsert });
        importedGames += mttSessionsToInsert.length;
    }

    // ========================================
    // 5. Log Import
    // ========================================
    try {
        await prisma.importLog.create({
            data: {
                fileName: 'Excel Upload',
                periodStart: dateStart,
                periodEnd: dateEnd,
                status: 'SUCCESS',
            }
        });
    } catch (e) {
        console.error('Failed to create ImportLog:', e);
    }

    return { users: importedUsers, games: importedGames };
}
