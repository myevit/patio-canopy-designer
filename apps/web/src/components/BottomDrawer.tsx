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
}

export function BottomDrawer({ open, tab, onSelectTab, onToggleOpen }: BottomDrawerProps) {
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
          <p>{TAB_DESCRIPTIONS[tab]}: not available in this milestone.</p>
        </div>
      )}
    </section>
  );
}
