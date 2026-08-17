import type { ReactNode } from "react";
import type { DrawerTab } from "../state/studio-store.js";

const TABS: { id: DrawerTab; label: string }[] = [
  { id: "bom", label: "BOM" },
  { id: "cuts", label: "Cuts" },
  { id: "blueprints", label: "Blueprints" },
];

const TAB_DESCRIPTIONS: Record<DrawerTab, string> = {
  bom: "Bill of materials",
  cuts: "Cut list",
  blueprints: "Blueprint sheets",
};

export interface BottomDrawerProps {
  open: boolean;
  tab: DrawerTab;
  onSelectTab: (tab: DrawerTab) => void;
  onToggleOpen: () => void;
  bomContent?: ReactNode;
  cutsContent?: ReactNode;
  blueprintsContent?: ReactNode;
}

export function BottomDrawer({
  open,
  tab,
  onSelectTab,
  onToggleOpen,
  bomContent,
  cutsContent,
  blueprintsContent,
}: BottomDrawerProps) {
  const content: Record<DrawerTab, ReactNode> = {
    bom: bomContent ?? <p>{TAB_DESCRIPTIONS.bom}: not available in this milestone.</p>,
    cuts: cutsContent ?? <p>{TAB_DESCRIPTIONS.cuts}: not available in this milestone.</p>,
    blueprints: blueprintsContent ?? <p>{TAB_DESCRIPTIONS.blueprints}: not available in this milestone.</p>,
  };
  return (
    <section aria-label="Output drawer" className={open ? "drawer drawer--open" : "drawer drawer--closed"}>
      <div className="drawer__header">
        <div role="tablist" aria-label="Output" className="drawer__tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              className={t.id === tab ? "drawer__tab drawer__tab--active" : "drawer__tab"}
              onClick={() => onSelectTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="drawer__toggle" onClick={onToggleOpen}>
          {open ? "Collapse" : "Expand"}
        </button>
      </div>
      {open && (
        <div className="drawer__content" role="tabpanel">
          {content[tab]}
        </div>
      )}
    </section>
  );
}
