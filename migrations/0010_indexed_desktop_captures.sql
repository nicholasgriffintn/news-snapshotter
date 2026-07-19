CREATE VIEW indexed_desktop_captures AS
SELECT *
FROM analysed_captures
WHERE device = 'desktop' AND status = 'indexed';
