# Accent audition

- Run: 2026-08-23
- Region: `southeastasia`
- SDK: microsoft-cognitiveservices-speech-sdk
- Format: Riff24Khz16BitMonoPcm
- Characters synthesised: 8040
- Command: `npm run eval:voices -- --live --stt`

Sentence, identical for every voice:

> Thanks for joining today. Before we start, could you walk me through the three projects on your CV, and describe a really difficult situation where your team's results were worse than you had expected?

**The `Accent` and `Verdict` columns are for a human to fill in after listening.** Everything else is machine-generated. WER is an intelligibility floor only — it cannot distinguish clear accented English from native English, so a low WER is necessary for a mapping to ship but nowhere near sufficient.

> Verdict column is one listener's judgement on a single sentence, N=1. Not a rater study.

| # | Nationality | Voice | Locale | Gender | Synth | WER | Auto | Recognised as | Accent (none/slight/clear) | Verdict (use/reject) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | American | `en-US-AriaNeural` | en-US | female | ok | 0% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 2 | American | `en-US-GuyNeural` | en-US | male | ok | 0% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 3 | British | `en-GB-SoniaNeural` | en-GB | female | ok | 0% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 4 | British | `en-GB-RyanNeural` | en-GB | male | ok | 0% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 5 | Brazilian | `pt-BR-FranciscaNeural` | pt-BR | female | ok | 71% | listen closely — recogniser struggled | Thanks for joining today before we start Koji project. Ion where you are. Expected. | not an accent | **reject** |
| 6 | Brazilian | `pt-BR-AntonioNeural` | pt-BR | male | ok | 56% | listen closely — recogniser struggled | Thank you for joining today. Before we start, could you walk me through the three projects | not an accent | **reject** |
| 7 | Canadian | `en-CA-ClaraNeural` | en-CA | female | ok | 0% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 8 | Canadian | `en-CA-LiamNeural` | en-CA | male | ok | 3% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 9 | Chinese | `zh-CN-XiaoxiaoNeural` | zh-CN | female | ok | 3% | listen | Thanks for joining today. Before we start, could you walk me through the free projects on  | accented | use |
| 10 | Chinese | `zh-CN-YunxiNeural` | zh-CN | male | ok | 3% | listen | Thanks for joining today. Before we start, could you walk me through the free projects on  | accented | use |
| 11 | Danish | `da-DK-ChristelNeural` | da-DK | female | ok | 0% | listen | Thanks for joining today. Before we start, could you walk me through the three projects on | accented | use |
| 12 | Danish | `da-DK-JeppeNeural` | da-DK | male | ok | 21% | listen closely — recogniser struggled | The thanks for joining today. Before we start, could you organize the projects on your CV  | accented | use |
| 13 | French | `fr-FR-DeniseNeural` | fr-FR | female | ok | 12% | listen | Thanks for joining me today. Before we start, could you walk me through the three project  | accented | use |
| 14 | French | `fr-FR-HenriNeural` | fr-FR | male | ok | 9% | listen | Thanks for joining today. Before we start, could you walk me through the three project on  | accented | use |
| 15 | German | `de-DE-KatjaNeural` | de-DE | female | ok | 0% | listen | Thanks for joining today. Before we start, could you walk me through the three projects on | accented | use |
| 16 | German | `de-DE-ConradNeural` | de-DE | male | ok | 3% | listen | Thanks for joining today. Before we start, could you walk me through the three projects on | accented | use |
| 17 | Indian | `en-IN-NeerjaNeural` | en-IN | female | ok | 0% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 18 | Indian | `en-IN-PrabhatNeural` | en-IN | male | ok | 3% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 19 | Indonesian | `id-ID-GadisNeural` | id-ID | female | ok | 26% | listen closely — recogniser struggled | Thanks for joining today. Before we start Koti, walk me through the three projects on your | accented | use |
| 20 | Indonesian | `id-ID-ArdiNeural` | id-ID | male | ok | 24% | listen closely — recogniser struggled | Thanks for joining today. Before we start quality, walk me through the three projects on y | accented | use |
| 21 | Italian | `it-IT-ElsaNeural` | it-IT | female | ok | 0% | listen | Thanks for joining today. Before we start, could you walk me through the three projects on | accented | use |
| 22 | Italian | `it-IT-DiegoNeural` | it-IT | male | ok | 0% | listen | Thanks for joining today. Before we start, could you walk me through the three projects on | accented | use |
| 23 | Japanese | `ja-JP-NanamiNeural` | ja-JP | female | ok | 29% | listen closely — recogniser struggled | Thanks for joining today. Before we started, walk me through the three projects on your sh | not an accent | **reject** |
| 24 | Japanese | `ja-JP-KeitaNeural` | ja-JP | male | ok | 50% | listen closely — recogniser struggled | Thanks for joining you today. Before we start, Kotoyu Okami through the three projects on  | not an accent | **reject** |
| 25 | Kenyan | `en-KE-AsiliaNeural` | en-KE | female | ok | 0% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 26 | Kenyan | `en-KE-ChilembaNeural` | en-KE | male | ok | 3% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 27 | Korean | `ko-KR-SunHiNeural` | ko-KR | female | ok | 38% | listen closely — recogniser struggled | Thanks for joining today. People with tattoo could you or could be through to three projec | accented | use |
| 28 | Korean | `ko-KR-InJoonNeural` | ko-KR | male | ok | 38% | listen closely — recogniser struggled | Things support joining today. People restart. Could you walk me through to three projects  | accented | use |
| 29 | Mexican | `es-MX-DaliaNeural` | es-MX | female | ok | 0% | listen | Thanks for joining today. Before we start, could you walk me through the three projects on | accented | use |
| 30 | Mexican | `es-MX-JorgeNeural` | es-MX | male | ok | 3% | listen | Thanks for joining today. Before we start, could you walk me through the three projects on | accented | use |
| 31 | Nigerian | `en-NG-EzinneNeural` | en-NG | female | ok | 3% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 32 | Nigerian | `en-NG-AbeoNeural` | en-NG | male | ok | 0% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 33 | Singaporean | `en-SG-LunaNeural` | en-SG | female | ok | 0% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 34 | Singaporean | `en-SG-WayneNeural` | en-SG | male | ok | 0% | native English locale | Thanks for joining today. Before we start, could you walk me through the three projects on | native | use (native English locale) |
| 35 | Spanish | `es-ES-ElviraNeural` | es-ES | female | ok | 9% | listen | Thanks for joining today. Before we start called, you walk me through the three projects o | accented | use |
| 36 | Spanish | `es-ES-AlvaroNeural` | es-ES | male | ok | 6% | listen | Thanks for joining today. Before we start, could you walk me through the three projects on | accented | use |
| 37 | Swedish | `sv-SE-SofieNeural` | sv-SE | female | ok | 0% | listen | Thanks for joining today. Before we start, could you walk me through the three projects on | accented | use |
| 38 | Swedish | `sv-SE-MattiasNeural` | sv-SE | male | ok | 0% | listen | Thanks for joining today. Before we start, could you walk me through the three projects on | accented | use |
| 39 | Vietnamese | `vi-VN-HoaiMyNeural` | vi-VN | female | ok | 65% | listen closely — recogniser struggled | Thanks for your name today. Before we start, don't you work Method Route 33 project on you | not an accent | **reject** |
| 40 | Vietnamese | `vi-VN-NamMinhNeural` | vi-VN | male | ok | 65% | listen closely — recogniser struggled | Thanks for joining today. Before we start Galuch Metro 3 project on your survey and that's | not an accent | **reject** |

## Outcome

Auditioned by ear on 2026-08-23. Accepted: Chinese, Korean, Swedish, Spanish,
Mexican, French, German, Italian, Danish, Indonesian — plus the fourteen native
English locales, which need no audition. **Rejected: Japanese, Vietnamese,
Brazilian.** Those three do not produce an accent; a monolingual voice maps
English spelling through its own letter values and phoneme inventory, so the
words are rebuilt rather than accented. No better option exists in those
locales — every plain voice advertises zero English support, and the only
alternatives are Azure's multilingual voices, which are designed to sound
native and would remove the accent altogether. Sampling was partial for two of
them: 2 of 7 available `ja-JP` voices and 2 of 16 `pt-BR`; both `vi-VN` voices
were tested.

Audio: `docs/artifacts/voice-audition/` (git-ignored — regenerate rather than commit).
