# Optional data transmission in the extension

Reading and the LPE do not require external data transmission. The Firefox
manifest declares `required: ["none"]` plus optional transmission categories,
following Mozilla's built-in consent schema. There is no Lumen-operated AI or
sync backend; opting in sends data directly to the user's chosen service.

| User action                                             | Firefox optional data categories                                                    | Destination                                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Allow a cloud provider connection / test or list models | authenticationInfo                                                                  | Selected provider only                                                                                   |
| Enable remote content sharing                           | personalCommunications, websiteContent                                              | Selected provider: chat, excerpts and explicitly enabled annotations                                     |
| Authorize Dropbox sync                                  | authenticationInfo, personalCommunications, websiteContent, technicalAndInteraction | Dropbox: OAuth credentials and synced book records (annotations, saved reading positions and typography) |
| Allow local model downloads                             | No content categories; optional download hosts only                                 | Hugging Face model assets; inference stays on-device                                                     |
| Connect a loopback provider                             | Optional localhost host permission only                                             | User-controlled localhost server, not a cloud provider                                                   |

`technicalAndInteraction` is included for optional sync of reading state; it
does not enable analytics. Firefox may offer that category as an optional
installation checkbox. No sync runs unless the user authorizes Dropbox.

Synced book records also include saved chat sessions, covered by the optional
`personalCommunications` category. No chat history is transmitted by local reading.

Browser host access is not API-key validation. The existing Test connection
button checks the provider separately. A successful permission prompt must not
be described as a successful authenticated API call.

Native consent is requested only in settings controls, synchronously from a
user gesture. Chromium receives no Firefox-specific permission keys and keeps
the application's explicit content-sharing consent. On Firefox, all LLM entry
points (including classification and suggestions) and Dropbox operations
recheck their permissions before starting a request. Revocation blocks future
requests; it cannot retract data from a request already sent. The settings UI
refreshes permission status when the browser grants or revokes permissions.

API keys are session-only. Dropbox refresh tokens are stored locally to support
user-authorized sync. This does not mean that the provider or Dropbox discards
received data: their own policies apply and must be disclosed to users.

UI fonts and icons are bundled with licenses. Extension exports disable both
GTM paths and Sentry integration independently of developer analytics flags.

Reference: https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
