from __future__ import annotations

import runpy
from pathlib import Path


if __name__ == "__main__":
    importer = Path(__file__).resolve().parents[1] / "importers" / "multi_operator_import.py"
    runpy.run_path(str(importer), run_name="__main__")
