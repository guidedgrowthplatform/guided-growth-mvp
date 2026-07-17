<!-- GENERATED FILE — v1 compatibility values until the Phase B generator owns this document. -->

# Onboarding analytics ID remap

## Dashboard and saved-query update

Keep the existing session-log event schema unchanged. `screen_id` continues to record the executed canonical variant. Add a derived reporting dimension in PostHog dashboards and saved queries using the variant-to-base table below, then update filters, breakdowns, and cohorts to use that dimension where base-level reporting is intended.

PostHog event history is immutable: this one-time migration does not rewrite historical events. Queries must coalesce the legacy ID → canonical ID mapping before applying the variant → reporting-base mapping.

## Legacy ID to canonical ID

| Legacy ID                         | Canonical ID          |
| --------------------------------- | --------------------- |
| `onboard_01`                      | `ONBOARD-01`          |
| `onboard_02`                      | `ONBOARD-FORK`        |
| `onboard_03`                      | `ONBOARD-BEGINNER-01` |
| `onboard_04`                      | `ONBOARD-BEGINNER-02` |
| `onboard_05`                      | `ONBOARD-BEGINNER-03` |
| `onboard_06`                      | `ONBOARD-BEGINNER-04` |
| `onboard_07`                      | `STARTING-PLAN`       |
| `onboard_08`                      | `ONBOARD-BEGINNER-07` |
| `onboard_advanced_input`          | `ONBOARD-ADVANCED`    |
| `onboard_advanced_results`        | `ONBOARD-ADVANCED-02` |
| `onboard_advanced_step_6`         | `ONBOARD-ADVANCED-04` |
| `onboard_advanced_custom_prompts` | `ONBOARD-ADVANCED-05` |

## Variant ID to reporting base ID

No v1 session-log IDs require a reporting-base collapse. Retain the executed canonical `screen_id`.

## Canonical IDs without legacy aliases

None in the v1 compatibility map.
