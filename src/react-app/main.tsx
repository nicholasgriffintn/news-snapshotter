import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles.css";
import "./styles/components.css";
import "./styles/branding.css";
import "./styles/archive.css";
import "./styles/admin.css";
import "./styles/contact.css";
import "./styles/legal.css";
import "./styles/history.css";
import "./styles/research.css";
import "./styles/comparison.css";
import "./styles/responsive.css";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
