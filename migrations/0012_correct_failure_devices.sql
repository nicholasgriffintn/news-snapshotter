UPDATE extraction_failures
SET device = 'mobile'
WHERE capture_id LIKE '%:mobile:%';
