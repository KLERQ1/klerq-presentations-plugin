"""Shared helpers: every KLERQ workspace has its own MCP address."""
import re

BASE_DOMAIN = "mcp.klerq.app"
DEFAULT_TENANT = "klerq"  # KLERQ's own workspace
UNIVERSAL = "universal"  # the bare base domain: one address for every workspace (once the server supports it)


def validate(label):
    if not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label or ""):
        raise SystemExit(f"tenant must be a single DNS label (letters, digits, hyphens): {label!r}")
    return label


def mcp_host(tenant):
    if tenant == UNIVERSAL:
        return BASE_DOMAIN
    return f"{validate(tenant or DEFAULT_TENANT)}.{BASE_DOMAIN}"


def mcp_url(tenant):
    return f"https://{mcp_host(tenant)}/mcp"


def out_name(stem, tenant):
    if tenant == UNIVERSAL:
        return f"{stem}-universal.zip"
    return f"{stem}-{validate(tenant)}.zip" if tenant else f"{stem}.zip"


def parse_tenant(argv):
    """Pull `--tenant X` / `--tenant=X` / `--universal` out of argv; returns (tenant or None, remaining args)."""
    tenant, rest, i = None, [], 0
    while i < len(argv):
        a = argv[i]
        if a == "--universal":
            tenant = UNIVERSAL
            i += 1
            continue
        if a == "--tenant":
            if i + 1 >= len(argv):
                raise SystemExit("--tenant needs a value")
            tenant = validate(argv[i + 1])
            i += 2
            continue
        if a.startswith("--tenant="):
            tenant = validate(a.split("=", 1)[1])
            i += 1
            continue
        rest.append(a)
        i += 1
    return tenant, rest
