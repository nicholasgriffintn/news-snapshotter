export function displayLabel(value: string): string {
	if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(value)) return value;
	return value
		.split(/[-_]/)
		.map((part) => part[0]?.toUpperCase() + part.slice(1))
		.join(" ");
}
