import { useSimulatorStore } from "./store/simulatorStore";
import { FileDropZone } from "./components/FileDropZone";
import { SetupPanel } from "./components/SetupPanel";
import { ControlPanel } from "./components/ControlPanel";
import { PositionPanel } from "./components/PositionPanel";
import { TradePanel } from "./components/TradePanel";
import { Chart } from "./components/Chart";
import { ReportButton } from "./components/ReportButton";

export default function App() {
  const { phase, allCandles } = useSimulatorStore();

  if (allCandles.length === 0) {
    return (
      <div className="app">
        <h1>Trading Simulator</h1>
        <FileDropZone />
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <div className="app">
        <h1>Trading Simulator</h1>
        <SetupPanel />
      </div>
    );
  }

  return (
    <div className="app">
      <h1>Trading Simulator</h1>
      <div className="simulator-layout">
        <div className="sidebar">
          <ControlPanel />
          <PositionPanel />
          <TradePanel />
          <ReportButton />
        </div>
        <div className="main-content">
          <Chart />
        </div>
      </div>
    </div>
  );
}
