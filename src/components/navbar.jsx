"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut, User, Globe, Moon, Sun } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import Image from "next/image";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import { useLanguage } from "@/lib/i18n";

export default function Navbar() {
    const { data: session } = useSession();
    const { t, language, toggleLanguage } = useLanguage();
    const { setTheme, theme, resolvedTheme } = useTheme();
    const user = session?.user;

    // Determine which favicon to show
    const faviconSrc = (theme === "light" || resolvedTheme === "light")
        ? "/favicon_light.ico"
        : "/favicon_dark.ico";

    const handleLogout = () => {
        signOut({ callbackUrl: "/login" });
    };

    return (
        <nav className="border-b bg-white dark:bg-zinc-950 px-6 py-3 flex items-center justify-between shadow-sm">
            {/* Logo Area */}
            <div className="flex items-center gap-2">
                <Image
                    src={faviconSrc}
                    alt="SPC Logo"
                    width={32}
                    height={32}
                    className="mr-2"
                />
                {/* <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                    SPC
                </div> */}
                <span className="font-bold text-xl hidden sm:inline-block text-primary">{t("club_name")}</span>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
                {/* Localization Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-primary flex items-center gap-2"
                    onClick={toggleLanguage}
                >
                    <Globe className="h-5 w-5" />
                    <span className="uppercase text-xs font-bold">{language === "en" ? "עב" : "EN"}</span>
                </Button>

                {/* Theme Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                >
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>

                {/* User Menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                            <Avatar className="h-10 w-10 border-2 border-primary/20">
                                <AvatarImage src="/avatars/01.png" alt={user?.name} />
                                <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                                    {user?.name?.[0] || user?.code?.[0] || "U"}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end" forceMount>
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{user?.name || t("status")}</p>
                                <p className="text-xs leading-none text-muted-foreground">
                                    {t("code")}: {user?.code}
                                </p>
                                <p className="text-xs leading-none text-blue-600 font-semibold mt-1">
                                    {user?.role}
                                </p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="text-red-500 hover:text-red-600 cursor-pointer">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>{t("logout")}</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </nav>
    );
}
