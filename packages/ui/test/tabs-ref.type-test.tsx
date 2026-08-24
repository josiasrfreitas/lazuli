import { createRef } from "react";

import { Tabs, TabsList, TabsPanel, TabsTab } from "../src/components/tabs.js";

const rootRef = createRef<HTMLDivElement>();
const listRef = createRef<HTMLDivElement>();
const tabRef = createRef<HTMLButtonElement>();
const panelRef = createRef<HTMLDivElement>();

export const tabsWithRefs = (
  <Tabs defaultValue="ativos" ref={rootRef} size="md" variant="underline">
    <TabsList ref={listRef}>
      <TabsTab ref={tabRef} value="ativos">
        Ativos
      </TabsTab>
      <TabsTab disabled value="arquivados">
        Arquivados
      </TabsTab>
    </TabsList>
    <TabsPanel ref={panelRef} value="ativos">
      Contratos ativos
    </TabsPanel>
  </Tabs>
);

// @ts-expect-error Tabs variant only accepts the appearances defined by the variants.
export const invalidTabsVariant = <Tabs variant="pills" />;

// @ts-expect-error A tab must declare the value of the panel it activates.
export const tabWithoutValue = <TabsTab>Ativos</TabsTab>;
