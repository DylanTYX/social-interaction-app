# Accent audition — full-locale exploration

A locale rejected after hearing two of its voices has been sampled, not tested. This is every GA voice those locales have, so the rejection can be called final on evidence rather than on a sample of two.

- Run: 2026-08-24
- Region: `southeastasia`
- Characters synthesised: 6231
- Command: `npm run eval:voices -- --explore=ja-JP,pt-BR,vi-VN --stt`

Same sentence as the main audition:

> Thanks for joining today. Before we start, could you walk me through the three projects on your CV, and describe a really difficult situation where your team's results were worse than you had expected?

`Multilingual` and `DragonHD` voices are included on purpose. They are excluded from the shipped table on the theory that they render English near-natively and so carry no accent — listen and confirm, because that theory was never tested.

| Locale | Voice | Gender | Kind | Synth | WER | Recognised as | Accent | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ja-JP | `ja-JP-AoiNeural` | female | plain | ok | 29% | Thanks for joining me today. Before we start though, could do you walk me throug | | |
| ja-JP | `ja-JP-DaichiNeural` | male | plain | ok | 53% | Sangsuful joining you today. Before we starto Cutoy OK me through the three proj | | |
| ja-JP | `ja-JP-KeitaNeural` | male | plain | ok | 38% | Thanks for joining you today. Before we start Kotoyu Okami through the three pro | | |
| ja-JP | `ja-JP-Masaru:DragonHDLatestNeural` | male | multilingual | ok | 0% | Thanks for joining today. Before we start, could you walk me through the three p | | |
| ja-JP | `ja-JP-MayuNeural` | female | plain | ok | 47% | Sangsu for joining today. Before we start though, could do you walk me through t | | |
| ja-JP | `ja-JP-Nanami:DragonHDLatestNeural` | female | multilingual | ok | 0% | Thanks for joining today. Before we start, could you walk me through the three p | | |
| ja-JP | `ja-JP-NanamiNeural` | female | plain | ok | 26% | Thanks for joining today. Before we start, walk me through the three projects on | | |
| ja-JP | `ja-JP-NaokiNeural` | male | plain | ok | 71% | Thanks for joining today. Before we starto kutoyu okami suru sasari projects on  | | |
| ja-JP | `ja-JP-ShioriNeural` | female | plain | ok | 24% | Thanks for joining today. Before we starto could do you walk me through the thre | | |
| pt-BR | `pt-BR-AntonioNeural` | male | plain | ok | 56% | Thank you for joining today. Before we start, could you walk me through the thre | | |
| pt-BR | `pt-BR-BrendaNeural` | female | plain | ok | 50% | Thanks for joining today. Before we start, could you walk me through the three p | | |
| pt-BR | `pt-BR-DonatoNeural` | male | plain | ok | 56% | Thank you for joining today. Before we start, could you walk me through the thre | | |
| pt-BR | `pt-BR-ElzaNeural` | female | plain | ok | 47% | Thank you for joining today. Before we start you walking me through the three pr | | |
| pt-BR | `pt-BR-FabioNeural` | male | plain | ok | 59% | Thank you for joining today. Before we start, could you walk me through the thre | | |
| pt-BR | `pt-BR-FranciscaNeural` | female | plain | ok | 65% | Thanks for joining today. Before we start Koji Owaki Mifrudetri project situatio | | |
| pt-BR | `pt-BR-GiovannaNeural` | female | plain | ok | 65% | Thanks for joining today. Before we start, Chikuji you walking through the three | | |
| pt-BR | `pt-BR-HumbertoNeural` | male | plain | ok | 53% | Thank you for joining today. Before we start, could you walk me through the thre | | |
| pt-BR | `pt-BR-JulioNeural` | male | plain | ok | 59% | Thank yous for joining today. Before we start it, could you walk me through the  | | |
| pt-BR | `pt-BR-LeilaNeural` | female | plain | ok | 29% | Thanks for joining today. Before we start, could you walk me through the three p | | |
| pt-BR | `pt-BR-LeticiaNeural` | female | plain | ok | 74% | Thanks for joining today. Before we start Kuju walking through the project Shizu | | |
| pt-BR | `pt-BR-Macerio:DragonHDLatestNeural` | male | multilingual | ok | 0% | Thanks for joining today. Before we start, could you walk me through the three p | | |
| pt-BR | `pt-BR-MacerioMultilingualNeural` | male | multilingual | ok | 0% | Thanks for joining today. Before we start, could you walk me through the three p | | |
| pt-BR | `pt-BR-ManuelaNeural` | female | plain | ok | 65% | Thanks for joining today. Before we start, Kojo walking me through the three pro | | |
| pt-BR | `pt-BR-NicolauNeural` | male | plain | ok | 68% | Thank you for joining today. Before we start Kuju walking me through the three p | | |
| pt-BR | `pt-BR-Thalita:DragonHDLatestNeural` | female | multilingual | ok | 0% | Thanks for joining today. Before we start, could you walk me through the three p | | |
| pt-BR | `pt-BR-ThalitaMultilingualNeural` | female | multilingual | ok | 0% | Thanks for joining today. Before we start, could you walk me through the three p | | |
| pt-BR | `pt-BR-ThalitaNeural` | female | plain | ok | 56% | Thanks for joining today. Before we start, Koji Woo walking me through day three | | |
| pt-BR | `pt-BR-ValerioNeural` | male | plain | ok | 44% | Thanks for joining today. Before we start, could you walk me through the three p | | |
| pt-BR | `pt-BR-YaraNeural` | female | plain | ok | 74% | Thank you for joining today. Before we start Kuju working through the three proj | | |
| vi-VN | `vi-VN-HoaiMyNeural` | female | plain | ok | 68% | Thanks for your name today. Before we start, don't you work method Route 33 proj | | |
| vi-VN | `vi-VN-NamMinhNeural` | male | plain | ok | 62% | Thanks for joining today. Before we start Galuch Metro 3 project on your survey  | | |

## Decision (2026-09-11)

Chosen by ear from the clips above.

| Nationality | Female | Male |
| --- | --- | --- |
| Brazilian | `pt-BR-LeilaNeural` | `pt-BR-MacerioMultilingualNeural` |

**Vietnamese:** the locale offers two voices, both rejected, and has no
multilingual variants. It was removed from the persona randomiser and the
accent map.

**Japanese:** the listener first picked `ja-JP-Nanami:DragonHDLatestNeural` and
`ja-JP-Masaru:DragonHDLatestNeural`, then removed Japanese entirely. It is out of
the persona randomiser and the accent map; a persona that still holds it uses
neutral English.

`pt-BR-MacerioMultilingualNeural` is a multilingual voice, which the shipped
table had excluded on the assumption that such voices sound native in English.
The listener judged it to keep the accent.

Re-running `--explore` regenerates this file; carry this section forward.
