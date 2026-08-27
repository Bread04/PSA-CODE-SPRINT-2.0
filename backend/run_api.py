"""Dev entrypoint: `python run_api.py` (or `uvicorn api.app:app --reload`).

Serves on http://127.0.0.1:8000. The console's `VITE_API_BASE_URL` should point
here (e.g. `http://127.0.0.1:8000`); with it unset the console uses same-origin.
"""

from __future__ import annotations

import uvicorn

if __name__ == "__main__":
    uvicorn.run("api.app:app", host="127.0.0.1", port=8000, reload=True)
