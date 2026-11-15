"""Outcome labels for BASS-II tests, read from each test's observation in NASA/TM-20210011385 Appendix A.
sustained: 1 = flame spread or burned steadily after the igniter was off; 0 = only a brief flame or would not sustain;
None = observation does not decide it (equipment problem, one-sided ignition trial, no note).
Labels were written by SI from the observation text and reviewed against it; the cross-check against
NTRS 20150008962 (T9, T10, T12 = no ignition) agrees."""
S = 1; N = 0; U = None
LAB = {
 'B1': S, 'B2': U, 'B3': S, 'B4': S, 'B5': S, 'B6': S, 'B7': S, 'B8': S, 'B9': S, 'B10': S, 'B11': S, 'B12': S, 'B13': S,
 'B14': N, 'B15': S, 'B16': S, 'B17': S, 'B18': S, 'B19': S, 'B20': S, 'B21': S, 'B22': S,
 'F1': N, 'F2': N, 'F3': N, 'F4': S,
 'M1': S, 'M2': S, 'M3': S, 'M4': S, 'M5': S, 'M6': S, 'M7': S, 'M8': S, 'M9': S, 'M10': S, 'M11': S, 'M12': S, 'M13': S,
 'M14': S, 'M15': S, 'M16': S, 'M17': S, 'M18': S, 'M19': S, 'M20': S,
 'O1': S, 'O2': S, 'O3a': S, 'O3b': S, 'O4': S, 'O5a': S, 'O5b': N, 'O6': U, 'O7': S, 'O8a': S, 'O8b': S, 'O9': S, 'O10': S,
 'O11': S, 'O12': N, 'O13a': S, 'O13b': N, 'O14': S, 'O15a': S, 'O15b': S, 'O16': N, 'O17': S, 'O18': S, 'O19': S,
 'P1': S, 'P2': S, 'P3a': S, 'P3b': S, 'P4': S, 'P5': S, 'P6': S, 'P8': N, 'P9': S, 'P10': S, 'P12': S, 'P13a': S, 'P13b': S,
 'P14': S, 'P15': S, 'P16': S, 'P17': S, 'P18': S, 'P19': S, 'P20': S, 'P21a': N, 'P21b': U, 'P22a': S, 'P22b': S, 'P23': S, 'P25': S,
 'T1': U, 'T2': S, 'T3': N, 'T4': S, 'T5': S, 'T6': S, 'T7': S, 'T9': N, 'T10': N, 'T11': S, 'T12': N, 'T13': S, 'T14': S,
 'T15': S, 'T16': S, 'T17': S, 'T18': N, 'T19': S, 'T20': S, 'T21': S, 'T22': S, 'T23': U, 'T24': S, 'T25': S, 'T26': S,
 'T27': S, 'T28a': U, 'T28b': U, 'T29': U,
}
NOTE = {'P8': 'flat sample tip', 'P21a': 'flattened sample end, dim flame', 'O13b': 'lit under a minute', 'T3': 'spherical section, brief flames',
        'T13': 'burned at 5 cm/s, out after flow cut', 'T14': 'burned at 5 cm/s, out below 3 cm/s', 'T18': 'out as it left the igniter'}
