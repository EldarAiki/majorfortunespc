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
 * Parse Union Member Statistics sheet
 * Returns: { users: Map<code, userData>, sessions: Array<sessionData> }
 */
function parseMemberStatistics(sheet) {
    const users = new Map();
    const sessions = [];
    let currentClub = null;

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber < DATA_START_ROW) return;
        if (isTotalRow(row)) return;

        // Check for club info in column 1
        const clubInfo = parseClubInfo(row.getCell(MEMBER_COLS.CLUB).value);
        if (clubInfo) {
            currentClub = clubInfo;
        }

        // Extract user identifiers
        const superAgentId = getString(row, MEMBER_COLS.SUPER_AGENT_ID);
        const superAgentName = getString(row, MEMBER_COLS.SUPER_AGENT_NAME);
        const agentId = getString(row, MEMBER_COLS.AGENT_ID);
        const agentName = getString(row, MEMBER_COLS.AGENT_NAME);
        const memberId = getString(row, MEMBER_COLS.MEMBER_ID);
        const memberName = getString(row, MEMBER_COLS.MEMBER_NAME);

        // Register Super Agent
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

        // Register Agent
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

        // Register Member (Player)
        if (memberId) {
            // Update or create member entry
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

            // Extract session data (Total P&L and Total Rake)
            const totalPnl = getNumber(row, MEMBER_COLS.TOTAL_PNL);
            const totalRake = getNumber(row, MEMBER_COLS.TOTAL_RAKE);

            if (totalPnl !== 0 || totalRake !== 0) {
                sessions.push({
                    userCode: memberId,
                    pnl: totalPnl,
                    rake: totalRake,
                    tableName: 'Cash Games',
                    hands: 0,
                });
            }
        }
    });

    return { users, sessions };
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

    // Get required sheets
    const memberSheet = workbook.getWorksheet('Union Member Statistics');
    const mttSheet = workbook.getWorksheet('Union MTT Detail');

    if (!memberSheet) {
        throw new Error("Sheet 'Union Member Statistics' not found.");
    }

    // Extract session date from sheet
    const sessionDate = extractDateFromSheet(memberSheet);
    const dateStart = new Date(sessionDate);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(sessionDate);
    dateEnd.setHours(23, 59, 59, 999);

    // Ensure current cycle exists
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
    const { users, sessions: memberSessions } = parseMemberStatistics(memberSheet);
    const mttSessions = parseMTTDetail(mttSheet);
    const allSessions = [...memberSessions, ...mttSessions];

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
    // 3. Save Game Sessions
    // ========================================
    
    // Delete existing sessions for this date (allows re-import)
    await prisma.gameSession.deleteMany({
        where: {
            date: { gte: dateStart, lte: dateEnd }
        }
    });

    // Prepare sessions for insert
    const sessionsToInsert = allSessions
        .filter(session => codeToId.has(session.userCode))
        .map(session => ({
            userId: codeToId.get(session.userCode),
            date: sessionDate,
            tableName: session.tableName,
            buyIn: 0,
            cashOut: 0,
            pnl: session.pnl,
            rake: session.rake,
            hands: session.hands,
            cycleId: currentCycle.id,
        }));

    let importedGames = 0;
    if (sessionsToInsert.length > 0) {
        await prisma.gameSession.createMany({ data: sessionsToInsert });
        importedGames = sessionsToInsert.length;
    }

    // ========================================
    // 4. Log Import
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
