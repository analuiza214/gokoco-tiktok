import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeMarketingScripts } from "@/lib/marketing";
import { saveTrackingParams } from "@/lib/tracking";

initializeMarketingScripts();
saveTrackingParams();

createRoot(document.getElementById("root")!).render(<App />);
