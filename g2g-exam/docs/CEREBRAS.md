# Cerebras writing grading

Configure the API key in Settings → Advanced → AI writing grading. The shared
secret service encrypts it on the server; it is never returned to the browser.
Alternatively supply `CEREBRAS_API_KEY` in the server environment.

Uses `https://api.cerebras.ai/v1/chat/completions`, model `gpt-oss-120b`, JSON
output, low reasoning effort and a 4096-token completion budget (including
reasoning). Uses the same teacher rubric, validation, score clamp and job queue
as existing providers. Only configured providers run; quota cooldown and dashboard
filter/counts are shared. Existing provider preference is unchanged.

API reference: https://inference-docs.cerebras.ai/api-reference/chat-completions
Model example: https://github.com/Cerebras/cerebras-cloud-sdk-node
