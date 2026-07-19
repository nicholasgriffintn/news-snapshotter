ALTER TABLE page_elements ADD COLUMN prominence TEXT
	CHECK (prominence IN ('lead', 'major', 'standard', 'minor'));

UPDATE page_elements
SET prominence = CASE
	WHEN width / MAX((
		SELECT analysed_captures.page_width
		FROM analysed_captures
		WHERE analysed_captures.capture_id = page_elements.capture_id
	), 1) >= 0.3333333333333333 THEN 'major'
	WHEN width / MAX((
		SELECT analysed_captures.page_width
		FROM analysed_captures
		WHERE analysed_captures.capture_id = page_elements.capture_id
	), 1) < 0.1666666666666667 THEN 'minor'
	ELSE 'standard'
END;
