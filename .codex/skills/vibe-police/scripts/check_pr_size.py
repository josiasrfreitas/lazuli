#!/usr/bin/env python3
"""Measure a committed PR diff; refuse dirty checkouts and unmeasurable changes."""

import argparse
import json
import re
import subprocess
import sys


MINIMUM = None
LIMIT = None
TEST_DIRECTORY = re.compile(
    r"^(?:(?:apps|packages|tooling)/[^/]+/(?:test|tests|e2e|__tests__)/|scripts/test/)"
)
TEST_FILE = re.compile(r"(?:^|/)[^/]+\.(?:test|spec)\.[cm]?[jt]sx?$")
DOCUMENTATION_DIRECTORY = re.compile(r"(?:^|/)(?:docs?|documentation)/")
DOCUMENTATION_FILE = re.compile(
    r"(?:\.(?:md|mdx|rst|adoc)|\.stories\.[cm]?[jt]sx?)$", re.IGNORECASE
)
SCRIPT_DIRECTORY = re.compile(r"(?:^|/)scripts/")
SEED_SCRIPT = re.compile(r"^packages/db/(?:src|prisma)/(?:seed(?:-[^/]*)?\.[cm]?[jt]sx?$|seeds/)")
SCRIPT_FILE = re.compile(r"\.(?:sh|bash|zsh|ps1|bat|cmd)$", re.IGNORECASE)


def exclusion(path):
    if TEST_DIRECTORY.search(path) or TEST_FILE.search(path):
        return "test"
    if DOCUMENTATION_DIRECTORY.search(path) or DOCUMENTATION_FILE.search(path):
        return "documentation"
    if SCRIPT_DIRECTORY.search(path) or SCRIPT_FILE.search(path) or SEED_SCRIPT.search(path):
        return "script"
    return None



def git(*args):
    result = subprocess.run(
        ["git", *args], capture_output=True, text=True, encoding="utf-8", errors="surrogateescape"
    )
    if result.returncode:
        raise ValueError(result.stderr.strip())
    return result.stdout


def commit(ref):
    return git("rev-parse", "--verify", "--end-of-options", ref + "^{commit}").strip()


def measure(base_ref, head_ref):
    # Run from the repository root so path classification cannot depend on the caller's cwd.
    if git("rev-parse", "--show-prefix").strip():
        raise ValueError("Run from the repository root.")
    if git("status", "--porcelain", "--untracked-files=all").strip():
        raise ValueError("Dirty checkout: commit the intended slice before measuring it.")
    base, head = commit(base_ref), commit(head_ref)
    ancestor = git("merge-base", base, head).strip()
    options = ("--no-ext-diff", "--no-textconv", "--no-renames", "--ignore-submodules=none")
    raw = git("diff", "--raw", "-z", *options, ancestor, head, "--").split("\0")
    for metadata in raw[:-1:2]:
        if "160000" in metadata.split()[:2] or metadata.startswith(":160000 "):
            raise ValueError("Submodule change: line size cannot be verified.")

    files = []
    feature_lines = 0
    excluded_lines = {"test": 0, "documentation": 0, "script": 0}
    binary_tests = []
    binary_excluded = []
    binary_features = []
    for record in git("diff", "--numstat", "-z", *options, ancestor, head, "--").split("\0"):
        if not record:
            continue
        added, removed, path = record.split("\t", 2)
        reason = exclusion(path)
        excluded = reason is not None
        binary = added == "-" or removed == "-"
        if binary and not excluded:
            binary_features.append(path)
        lines = 0 if binary else int(added) + int(removed)
        if excluded:
            excluded_lines[reason] += lines
            if binary:
                binary_excluded.append({"path": path, "reason": reason})
                if reason == "test":
                    binary_tests.append(path)
        else:
            feature_lines += lines
        files.append({
            "path": path,
            "added": None if binary else int(added),
            "removed": None if binary else int(removed),
            "excluded_test": reason == "test",
            "excluded_reason": reason,
        })

    return {
        "base": base,
        "merge_base": ancestor,
        "head": head,
        "minimum": MINIMUM,
        "limit": LIMIT,
        "feature_lines": feature_lines,
        "test_lines": excluded_lines["test"],
        "documentation_lines": excluded_lines["documentation"],
        "script_lines": excluded_lines["script"],
        "binary_excluded_files": binary_excluded,
        "binary_feature_files": binary_features,
        "binary_test_files": binary_tests,
        "passed": True,
        "files": files,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="Actual PR base ref, fetched before running")
    parser.add_argument("--head", default="HEAD", help="Committed PR head (default: HEAD)")
    args = parser.parse_args()
    try:
        report = measure(args.base, args.head)
    except (ValueError, OSError) as error:
        print(json.dumps({"passed": False, "error": str(error)}), file=sys.stderr)
        return 2
    print(json.dumps(report, indent=2))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
