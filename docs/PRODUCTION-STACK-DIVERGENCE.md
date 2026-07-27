# Production Stack Divergence Review

The `docker-stack` branch and `release/tenancy-platform-v1` both contain the production stack, but their `docker-compose.prod.yml` files are not equivalent.

## Nginx exposure

`docker-stack` publishes standard host ports:

- `80:80`
- `443:443`

`release/tenancy-platform-v1` currently publishes:

- `8181:80`
- `3000:443`

The release values may reflect a deliberate host-specific deployment choice. They must not be changed until the active production bindings are verified.

## Nginx template rendering

`docker-stack` includes an explicit startup command that:

- renders `/etc/nginx/templates/threatpulse.conf.template` using `DOMAIN`
- removes the default Nginx site
- runs `nginx -t`
- reloads Nginx periodically for renewed certificates

The release branch currently lacks this explicit command. Validation must determine whether the stock Nginx image entrypoint performs the required template rendering and whether certificate reload behavior is preserved.

## Release decision required

Before merging PR #4:

1. Inspect the active production container port bindings.
2. Inspect the rendered Nginx configuration on the deployment host.
3. Confirm whether ports 8181 and 3000 are intentional.
4. Preserve the active bindings unless a coordinated network change is approved.
5. Restore explicit Nginx configuration validation and reload behavior if it is not otherwise provided.

No automatic overwrite from `docker-stack` should be performed until these production facts are confirmed.
