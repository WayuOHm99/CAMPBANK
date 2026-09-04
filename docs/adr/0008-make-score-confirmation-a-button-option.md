# Make Score confirmation a Score Button option

Ordinary Score Buttons remain one-tap by default. An Admin may mark an
exceptional Score Button as requiring confirmation, for example a large award
or deduction that would be costly to mis-tap. The flag is stored on the Score
Button, returned through the existing Camp snapshots, and shown in the Admin
preview. Staff confirmation happens before the existing Score RPC is called;
it is a safety affordance rather than an authorization boundary, so the RPC
continues to derive and validate the trusted amount exactly as before.

This preserves the fast field workflow while allowing Camp-specific protection
without forcing confirmation on every ordinary action.
