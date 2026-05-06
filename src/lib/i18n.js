"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const dictionary = {
    en: {
        // Navbar
        club_name: "Social Poker Club",
        logout: "Log out",
        code: "Code",
        login: "Login",
        register: "Register",
        activate_account: "Activate Account",

        // Dashboard
        personal_stats: "Personal Statistics",
        my_club: "My Club",
        overview: "Overview",
        admin_panel: "Admin Panel",
        balance: "Balance",
        rakeback: "Rakeback %",
        total_rakeback_amount: "Total Rakeback",
        club_activity: "Club's Activity",
        manager_activity: "Manager Activity",
        assign_manager: "Assign manager",
        assign_whole_club: "Whole club assignment",
        assign_user_tree: "User & subtree",
        clear_manager: "Clear assignment",
        select_manager: "Manager",
        select_manager_button: "Select Manager",
        winning: "Winning",
        rake: "Rake",
        manager_hierarchy_layout: "Hierarchy layout",
        manager_view_by_club: "By clubs",
        manager_view_flat: "Agents & players only",
        full_club_under_manager: "full club scope",
        club_currently_full: "Club-wide assignee:",
        no_managers_defined: "No manager users defined.",
        no_activity_found: "No activity found.",
        super_agent: "Super Agent",
        agent: "Agent",
        player: "Player",
        total_balance: "Total Balance",
        recent_games: "Recent Games",
        export_excel: "Export Excel",
        date: "Date",
        type: "Type",
        table: "Table",
        buy_in: "Buy-in",
        cash_out: "Cash-out",
        pnl: "Total",
        status: "Status",
        actions: "Actions",

        // Admin
        data_upload: "Data Upload",
        report_file: "Report File (XLSX)",
        upload_success: "Upload successful!",
        upload_failed: "Upload failed",
        cycle_mgmt: "Cycle Management",
        current_cycle: "Current Cycle",
        close_cycle: "Close Current Cycle",
        manage_users: "Manage Users",
        manager_assignment: "Manager assignment",
        promote_existing_user_to_manager: "Promote existing user to manager",
        filter_users_for_promotion_placeholder: "Type to filter users by code, name or role",
        no_matching_users: "No matching users",
        promote_to_manager: "Promote to manager",
        revoke_manager_role_set_super_agent: "Revoke manager role (set to SUPER_AGENT)",
        filter_managers_for_revoke_placeholder: "Type to filter managers by code or name",
        no_matching_managers: "No matching managers",
        revoke_manager_role: "Revoke manager role",
        create_dedicated_manager_account: "Create dedicated manager account",
        create_new_manager_user: "Create new manager user",
        user_code: "User code",
        username: "Username",
        password: "Password",
        manager_code_placeholder: "e.g. MGR_001",
        manager_username_placeholder: "Manager username",
        minimum_4_characters: "Minimum 4 characters",
        cancel: "Cancel",
        create_manager: "Create manager",
        manager_promoted_success: "User promoted to manager successfully.",
        promotion_failed: "Promotion failed",
        promote_unexpected_error: "Unexpected error while promoting user.",
        manager_created_success: "Manager user created successfully.",
        creation_failed: "Creation failed",
        create_manager_unexpected_error: "Unexpected error while creating manager.",
        manager_revoked_success: "Manager role revoked. User is now SUPER_AGENT.",
        revoke_failed: "Revoke failed",
        revoke_unexpected_error: "Unexpected error while revoking manager role.",

        // Agent
        set_rakeback: "Set Rakeback",
        details: "Details",
        download_report: "Download Report",
        search_players: "Search players...",
        select_cycle: "Select Cycle",
        active: "Active",
        union_statistics: "Union statistics",
        cycle: "Cycle",
        loading_cycle_data: "Loading cycle data...",
        number_of_clubs: "Number of clubs",
        number_of_sessions: "Number of sessions",
        total_hands: "Total hands",
        active_players: "Active players",
        total_rake: "Total rake",
        total_winnings: "Total winnings",
        cycle_range: "Cycle range",
        winnings: "Winnings",
        users: "Users",
        total_winnings_plus_rake: "Total (Winnings + Rake)",
    },
    he: {
        // Navbar
        club_name: "  מועדון פוקר חברתי",
        logout: "התנתק",
        code: "קוד",
        login: "התחברות",
        register: "הרשמה",
        activate_account: "הפעלת חשבון",

        // Dashboard
        personal_stats: "סטטיסטיקה אישית",
        my_club: "המועדון שלי",
        overview: "סקירה כללית",
        admin_panel: "פאנל ניהול",
        balance: "מאזן",
        rakeback: "רייקבק %",
        total_rakeback_amount: "סה\"כ רייקבק",
        club_activity: "פעילות המועדון",
        manager_activity: "פעילות מנהלים",
        assign_manager: "שייך מנהל",
        assign_whole_club: "שיוך מועדון מלא",
        assign_user_tree: "משתמש ותת-עץ",
        clear_manager: "נקה שיוך",
        select_manager: "מנהל",
        select_manager_button: "בחר מנהל",
        winning: "רווח",
        rake: "רייק",
        manager_hierarchy_layout: "מבנה היררכיה",
        manager_view_by_club: "לפי מועדונים",
        manager_view_flat: "סוכנים ושחקנים בלבד",
        full_club_under_manager: "מועדון מלא",
        club_currently_full: "שיוך מועדון:",
        no_managers_defined: "אין משתמשי מנהל.",
        no_activity_found: "לא נמצאה פעילות.",
        super_agent: "סופר אייגנט",
        agent: "אייגנט",
        player: "שחקן",
        total_balance: "מאזן כולל",
        recent_games: "משחקים אחרונים",
        export_excel: "ייצוא לאקסל",
        date: "תאריך",
        type: "סוג",
        table: "סוג משחק",
        buy_in: "ביי-אין",
        cash_out: "קאש-אאוט",
        pnl: "רווח/הפסד",
        status: "סטטוס",
        actions: "פעולות",

        // Admin
        data_upload: "העלאת נתונים",
        report_file: "קובץ דוח (XLSX)",
        upload_success: "העלאה הצליחה!",
        upload_failed: "העלאה נכשלה",
        cycle_mgmt: "ניהול מחזורים",
        current_cycle: "מחזור נוכחי",
        close_cycle: "סגור מחזור נוכחי",
        manage_users: "ניהול משתמשים",
        manager_assignment: "שיוך מנהל",
        promote_existing_user_to_manager: "קדם משתמש קיים למנהל",
        filter_users_for_promotion_placeholder: "הקלד לסינון לפי קוד, שם או תפקיד",
        no_matching_users: "לא נמצאו משתמשים תואמים",
        promote_to_manager: "קדם למנהל",
        revoke_manager_role_set_super_agent: "בטל תפקיד מנהל (הגדר כסופר אייגנט)",
        filter_managers_for_revoke_placeholder: "הקלד לסינון מנהלים לפי קוד או שם",
        no_matching_managers: "לא נמצאו מנהלים תואמים",
        revoke_manager_role: "בטל תפקיד מנהל",
        create_dedicated_manager_account: "צור חשבון מנהל ייעודי",
        create_new_manager_user: "צור משתמש מנהל חדש",
        user_code: "קוד משתמש",
        username: "שם משתמש",
        password: "סיסמה",
        manager_code_placeholder: "לדוגמה: MGR_001",
        manager_username_placeholder: "שם משתמש מנהל",
        minimum_4_characters: "לפחות 4 תווים",
        cancel: "ביטול",
        create_manager: "צור מנהל",
        manager_promoted_success: "המשתמש קודם למנהל בהצלחה.",
        promotion_failed: "הקידום נכשל",
        promote_unexpected_error: "שגיאה בלתי צפויה בקידום משתמש.",
        manager_created_success: "משתמש מנהל נוצר בהצלחה.",
        creation_failed: "היצירה נכשלה",
        create_manager_unexpected_error: "שגיאה בלתי צפויה ביצירת מנהל.",
        manager_revoked_success: "תפקיד המנהל בוטל. המשתמש הוגדר כסופר אייגנט.",
        revoke_failed: "ביטול נכשל",
        revoke_unexpected_error: "שגיאה בלתי צפויה בביטול תפקיד מנהל.",

        // Agent
        set_rakeback: "הגדר רייקבק",
        details: "פרטים",
        download_report: "הורד דוח",
        search_players: "חפש שחקנים...",
        select_cycle: "בחר מחזור",
        active: "פעיל",
        union_statistics: "סטטיסטיקת יוניון",
        cycle: "מחזור",
        loading_cycle_data: "טוען נתוני מחזור...",
        number_of_clubs: "מספר מועדונים",
        number_of_sessions: "מספר סשנים",
        total_hands: "סה\"כ ידיים",
        active_players: "שחקנים פעילים",
        total_rake: "סה\"כ רייק",
        total_winnings: "סה\"כ זכיות",
        cycle_range: "טווח מחזור",
        winnings: "זכיות",
        users: "משתמשים",
        total_winnings_plus_rake: "סה\"כ (זכיות + רייק)",
    },
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState("he"); // Default to Hebrew

    useEffect(() => {
        const saved = localStorage.getItem("language");
        if (saved) setLanguage(saved);
    }, []);

    const toggleLanguage = () => {
        const newLang = language === "en" ? "he" : "en";
        setLanguage(newLang);
        localStorage.setItem("language", newLang);
    };

    const t = (key) => {
        return dictionary[language][key] || key;
    };

    const dir = language === "he" ? "rtl" : "ltr";

    return (
        <LanguageContext.Provider value={{ language, toggleLanguage, t, dir }}>
            <div dir={dir}>{children}</div>
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
