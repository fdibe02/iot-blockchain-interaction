# Riepilogo esperimenti

I valori seguenti sono calcolati escludendo le righe con `isInitializationTx=true`.

| Dataset | Gruppo | Metrica | N | Media | Min | Max |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| baseline-by-network | anvil | feeEth | 9 | 0.000224 | 0.000195 | 0.000265 |
| baseline-by-network | sepolia | feeEth | 9 | 0.000977 | 0.000536 | 0.00159 |
| baseline-by-network | anvil | gasUsed | 9 | 157265.33 | 157256.00 | 157268.00 |
| baseline-by-network | sepolia | gasUsed | 9 | 157268.00 | 157268.00 | 157268.00 |
| batch-vs-single | 1 | deviceToBlockLatencySeconds | 7 | 6.857143 | 2 | 15 |
| batch-vs-single | 5 | deviceToBlockLatencySeconds | 3 | 32.2 | 27 | 39 |
| batch-vs-single | 1 | feeEthPerMeasurement | 7 | 0.00017 | 0.000161 | 0.000178 |
| batch-vs-single | 5 | feeEthPerMeasurement | 3 | 0.000141 | 0.000133 | 0.000146 |
| batch-vs-single | 1 | gasPerMeasurement | 7 | 157334.86 | 157316.00 | 157340.00 |
| batch-vs-single | 5 | gasPerMeasurement | 3 | 130203.80 | 130203.00 | 130205.40 |
| storage-modes | full-storage | calldataBytes | 9 | 292 | 292 | 292 |
| storage-modes | hash-uri-storage | calldataBytes | 9 | 452 | 452 | 452 |
| storage-modes | latest-storage | calldataBytes | 9 | 292 | 292 | 292 |
| storage-modes | full-storage | feeEth | 9 | 0.000167 | 0.000155 | 0.000177 |
| storage-modes | hash-uri-storage | feeEth | 9 | 0.000225 | 0.000209 | 0.000238 |
| storage-modes | latest-storage | feeEth | 9 | 0.0000726234 | 0.0000688302 | 0.0000774306 |
| storage-modes | full-storage | gasUsed | 9 | 157266.67 | 157256.00 | 157268.00 |
| storage-modes | hash-uri-storage | gasUsed | 9 | 205109.67 | 205099.00 | 205123.00 |
| storage-modes | latest-storage | gasUsed | 9 | 68994.67 | 68976.00 | 69000.00 |
