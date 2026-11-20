"use client";
import type { ReactElement } from "react";
import { MapPin, Wallet } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@lazuli/ui";
import { AttendanceSettingsPage } from "~/features/student-attendance/settings";
import { SettingsPage } from "./settings-panel";
import styles from "./settings-home.module.css";

const SECTIONS = ["localizacao", "financeiro"] as const;

export function SettingsHome({ systemAdmin }: { systemAdmin: boolean }): ReactElement {
  const [section, setSection] = useQueryState(
    "secao",
    parseAsStringLiteral(SECTIONS).withDefault("localizacao"),
  );
  return (
    <div className={styles.page}>
      <Tabs
        render={<div className={styles.tabs} />}
        value={systemAdmin ? section : "localizacao"}
        onValueChange={(value) =>
          void setSection(value === "financeiro" ? "financeiro" : "localizacao")
        }
        variant="underline"
        size="sm"
      >
        <header className={styles.header}>
          <h1 className="font-display text-h3 text-heading">Ajustes</h1>
          {systemAdmin && (
            <TabsList aria-label="Seções de ajustes">
              <TabsTab value="localizacao">
                <MapPin aria-hidden="true" />
                Localização
              </TabsTab>
              <TabsTab value="financeiro">
                <Wallet aria-hidden="true" />
                Financeiro
              </TabsTab>
            </TabsList>
          )}
        </header>
        <TabsPanel value="localizacao" render={<div className={styles.panel} />}>
          <AttendanceSettingsPage />
        </TabsPanel>
        {systemAdmin && (
          <TabsPanel value="financeiro" render={<div className={styles.panel} />}>
            <SettingsPage />
          </TabsPanel>
        )}
      </Tabs>
    </div>
  );
}
