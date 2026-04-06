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

        // Agent
        set_rakeback: "Set Rakeback",
        details: "Details",
        download_report: "Download Report",
        search_players: "Search players...",
        select_cycle: "Select Cycle",
        active: "Active",
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

        // Agent
        set_rakeback: "הגדר רייקבק",
        details: "פרטים",
        download_report: "הורד דוח",
        search_players: "חפש שחקנים...",
        select_cycle: "בחר מחזור",
        active: "פעיל",
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
