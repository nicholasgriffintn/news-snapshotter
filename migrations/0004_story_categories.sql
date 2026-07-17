UPDATE story_observations
SET category = CASE
	WHEN lower(story_id) LIKE '%/sport/%' THEN 'Sport'
	WHEN lower(story_id) LIKE '%/iplayer/%' THEN 'iPlayer'
	WHEN lower(story_id) LIKE '%/sounds/%' THEN 'Sounds'
	WHEN lower(story_id) LIKE '%/bitesize/%' THEN 'Bitesize'
	WHEN lower(story_id) LIKE '%/weather/%' THEN 'Weather'
	WHEN lower(story_id) LIKE '%/culture/%' OR lower(story_id) LIKE '%/entertainment%' THEN 'Culture'
	WHEN lower(story_id) LIKE '%/business/%' THEN 'Business'
	WHEN lower(story_id) LIKE '%/politics/%' THEN 'Politics'
	WHEN lower(story_id) LIKE '%/world/%' THEN 'World'
	WHEN lower(story_id) LIKE '%/news/%' THEN 'News'
	ELSE 'Front page'
END
WHERE category IS NULL OR trim(category) = '';
