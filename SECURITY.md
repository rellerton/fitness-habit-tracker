# Security policy

## Supported versions

Security fixes are made on `main` and included in the next tagged release. Once
a release is published, only the latest release is supported. Older releases
should be upgraded rather than patched in place.

The current `v3.2.2` release predates the hardening already merged to `main`.
Until the next release is available, keep the add-on behind Home Assistant
ingress and do not expose its direct port to untrusted networks.

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** option in this repository's Security
tab. Include the affected version, impact, reproduction steps, and any proposed
mitigation. Do not include Home Assistant ingress paths, access tokens, database
contents, names, weights, or other household information.

Please allow time for acknowledgement and remediation before public disclosure.
Ordinary bugs and feature requests belong in GitHub Issues instead.

## Security boundary

Home Assistant ingress supplies authentication for normal add-on access. Direct
port access currently bypasses that boundary, so it is intended only for a
trusted private network until application-level API authentication is added.
