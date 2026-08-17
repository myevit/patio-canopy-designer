import { useEffect, useMemo, useReducer } from "react";
import { buildScene } from "@canopy/geometry";
import { SAMPLE_PROJECT } from "@canopy/shared";
import { BottomDrawer } from "./components/BottomDrawer.js";
import { Inspector } from "./components/Inspector.js";
import { PlanView } from "./components/PlanView.js";
import { StatusBar } from "./components/StatusBar.js";
import { ThreeView } from "./components/ThreeView.js";
import { Toolbar } from "./components/Toolbar.js";
import { ViewModeSwitcher } from "./components/ViewModeSwitcher.js";
import { findSceneObject } from "./scene/scene-selectors.js";
import { initialStudioState, studioReducer } from "./state/studio-store.js";

const SCENE = buildScene(SAMPLE_PROJECT);

export function App() {
  const [state, dispatch] = useReducer(studioReducer, initialStudioState);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dispatch({ type: "escape" });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selected = useMemo(
    () => findSceneObject(SCENE, state.selectedObjectId),
    [state.selectedObjectId],
  );

  const showPlan = state.viewMode === "plan" || state.viewMode === "split";
  const showThree = state.viewMode === "3d" || state.viewMode === "split";

  return (
    <div className="studio-shell">
      <header className="studio-shell__top-bar">
        <Toolbar activeTool={state.tool} onSelectTool={(tool) => dispatch({ type: "select-tool", tool })} />
        <ViewModeSwitcher
          viewMode={state.viewMode}
          onSelectViewMode={(viewMode) => dispatch({ type: "set-view-mode", viewMode })}
        />
      </header>

      <div className="studio-shell__body">
        <main className={state.viewMode === "split" ? "studio-shell__views studio-shell__views--split" : "studio-shell__views"}>
          {showPlan && (
            <PlanView
              scene={SCENE}
              selectedObjectId={state.selectedObjectId}
              onSelect={(objectId) => dispatch({ type: "select-object", objectId })}
            />
          )}
          {showThree && (
            <ThreeView
              scene={SCENE}
              selectedObjectId={state.selectedObjectId}
              onSelect={(objectId) => dispatch({ type: "select-object", objectId })}
            />
          )}
        </main>
        <Inspector selected={selected} />
      </div>

      <StatusBar tool={state.tool} interaction={state.interaction} />

      <BottomDrawer
        open={state.drawerOpen}
        tab={state.drawerTab}
        onSelectTab={(tab) => dispatch({ type: "set-drawer-tab", tab })}
        onToggleOpen={() => dispatch({ type: "toggle-drawer" })}
      />
    </div>
  );
}
