# Separate Staff Join and public Leaderboard links

Staff scoring and public Leaderboard access use separate, randomly generated Camp codes of at least 12 human-readable characters; database UUIDs and Admin-chosen slugs are not exposed for access. Because Staff intentionally authenticate without a PIN, sharing one public link for both surfaces would let a viewer select a Staff name and attempt Score actions; separate links preserve the short Staff flow while keeping public access read-only. Rotating the Staff code revokes that Camp’s Staff sessions so a leaked link no longer grants access.
