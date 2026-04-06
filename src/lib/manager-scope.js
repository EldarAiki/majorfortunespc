/**
 * Manager visibility: explicit user.managerId wins; otherwise whole-club assignment applies.
 */

export async function managerSubordinatesWhereClause(prisma, managerUserId) {
    const fullClubs = await prisma.clubFullManager.findMany({
        where: { managerId: managerUserId },
        select: { clubId: true },
    });
    const clubIds = fullClubs.map((r) => r.clubId);
    const or = [{ managerId: managerUserId }];
    if (clubIds.length > 0) {
        or.push({
            AND: [
                { clubId: { in: clubIds } },
                { OR: [{ managerId: null }, { managerId: managerUserId }] },
            ],
        });
    }
    return { OR: or };
}

export function filterUsersForManager(subPlayers, managerId, clubFullByClubId) {
    return subPlayers.filter((u) => {
        if (u.managerId === managerId) return true;
        if (u.managerId != null && u.managerId !== "") return false;
        if (!u.clubId) return false;
        return clubFullByClubId[u.clubId] === managerId;
    });
}
