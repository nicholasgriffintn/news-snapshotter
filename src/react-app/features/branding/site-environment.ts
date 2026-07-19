export type EnvironmentBadge = {
	label: string;
	tone: "development" | "preview" | "test";
};

export function environmentBadge(mode: string): EnvironmentBadge | undefined {
	if (mode === "production") {
		return undefined;
	}
	if (mode === "development") {
		return { label: "Development", tone: "development" };
	}
	if (mode === "preview" || mode === "staging") {
		return { label: "Preview", tone: "preview" };
	}
	return { label: "Test", tone: "test" };
}
