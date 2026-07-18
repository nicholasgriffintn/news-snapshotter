export class SQLiteD1Statement {
	bindings = [];

	constructor(database, sql) {
		this.database = database;
		this.sql = sql;
	}

	bind(...values) {
		this.bindings = values;
		return this;
	}

	async all() {
		return { results: this.database.prepare(this.sql).all(...this.bindings), success: true };
	}

	async first(column) {
		const row = this.database.prepare(this.sql).get(...this.bindings) ?? null;
		return column && row ? row[column] : row;
	}

	async run() {
		const result = this.database.prepare(this.sql).run(...this.bindings);
		return { meta: { changes: Number(result.changes) }, success: true };
	}
}

export class SQLiteD1 {
	constructor(database) {
		this.database = database;
	}

	prepare(sql) {
		return new SQLiteD1Statement(this.database, sql);
	}

	async batch(statements) {
		this.database.exec("BEGIN");
		try {
			const results = [];
			for (const statement of statements) {
				results.push(await statement.run());
			}
			this.database.exec("COMMIT");
			return results;
		} catch (error) {
			this.database.exec("ROLLBACK");
			throw error;
		}
	}

	async exec(sql) {
		this.database.exec(sql);
		return { count: 1, duration: 0 };
	}
}
