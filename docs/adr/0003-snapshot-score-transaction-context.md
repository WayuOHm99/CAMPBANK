# Snapshot display context on Score Transactions

Each Score Transaction stores the displayed Group, color, actor, Activity, and Round labels from the moment it occurred while retaining their entity IDs. This deliberately duplicates small amounts of data so later renames do not rewrite history, preserving an accurate audit trail without reconstructing labels from Audit Logs.
