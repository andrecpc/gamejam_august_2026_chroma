#!/usr/bin/env python3
"""Validate local script paths and named ES-module imports."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote


IMPORT_RE = re.compile(
    r"""import\s*\{(?P<names>[^}]+)\}\s*from\s*['"](?P<path>[^'"]+)['"]""",
    re.MULTILINE,
)
EXPORT_RE = re.compile(
    r"\bexport\s+(?:async\s+)?(?:class|function|var|let|const)\s+([A-Za-z_$][\w$]*)"
)
EXPORT_LIST_RE = re.compile(r"\bexport\s*\{([^}]+)\}", re.MULTILINE)
SCRIPT_RE = re.compile(r"""<script[^>]+src=['"]([^'"]+)['"]""", re.IGNORECASE)


def exported_names(source: str) -> set[str]:
    names = set(EXPORT_RE.findall(source))
    for match in EXPORT_LIST_RE.finditer(source):
        for item in match.group(1).split(","):
            item = item.strip()
            if not item:
                continue
            names.add(item.split(" as ")[-1].strip())
    return names


def clean_relative(raw_path: str) -> str:
    return unquote(raw_path.split("?", 1)[0].split("#", 1)[0])


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    root = Path(__file__).parents[1].resolve()
    errors: list[str] = []
    checked_imports = 0

    index_path = root / "index.html"
    index_source = index_path.read_text(encoding="utf-8")
    for raw_path in SCRIPT_RE.findall(index_source):
        if raw_path.startswith(("http://", "https://", "data:")):
            continue
        target = root / clean_relative(raw_path)
        if not target.is_file():
            errors.append(f"index.html: не найден script src {raw_path!r}")

    module_files = [
        path
        for path in (root / "js").rglob("*.js")
        if "lib" not in path.parts
    ]
    export_cache: dict[Path, set[str]] = {}
    for source_path in module_files:
        source = source_path.read_text(encoding="utf-8")
        for match in IMPORT_RE.finditer(source):
            raw_target = match.group("path")
            if not raw_target.startswith("."):
                continue
            target = (source_path.parent / clean_relative(raw_target)).resolve()
            checked_imports += 1
            if not target.is_file():
                errors.append(
                    f"{source_path.relative_to(root)}: не найден модуль {raw_target!r}"
                )
                continue
            if target not in export_cache:
                export_cache[target] = exported_names(
                    target.read_text(encoding="utf-8")
                )
            available = export_cache[target]
            for raw_name in match.group("names").split(","):
                imported = raw_name.strip().split(" as ")[0].strip()
                if imported and imported not in available:
                    errors.append(
                        f"{source_path.relative_to(root)}: {imported!r} "
                        f"не экспортируется из {target.relative_to(root)}"
                    )

    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    print(
        f"Checked {len(module_files)} JS files and {checked_imports} named imports: "
        f"{len(errors)} errors"
    )
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
