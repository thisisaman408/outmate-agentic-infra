# Bumped from 6000 → 200000 because agent outputs (e.g. Lead Discovery formatted
# multi-lead reports) routinely exceed 6000 chars and were getting silently
# truncated by vertex_build.serialize_data, causing the frontend dashboard to
# only render the first ~4-5 leads of a 10-lead run.
MAX_TEXT_LENGTH = 200000
MAX_ITEMS_LENGTH = 1000
