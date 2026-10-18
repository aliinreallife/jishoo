"""Owned synthetic account checks; signed history fixture is preview-only."""
import secrets
from urllib.parse import urlencode
from security_release_smoke import google_member, fixture, client, owned


def main():
    try:
        member, initial = google_member('آزمایش فریز و نقشه')
        assert not initial['me']['mapVisibilityReviewed']
        assert not initial['me']['shareLocation'] and not initial['me']['discoverable']
        assert initial['stats']['streak']['current'] == 0
        point = {'lat': 3.032, 'lng': -143.024}
        assert member.call('map-visibility', {'mode': 'profile', 'reviewOnly': True})['mode'] == 'hidden'
        state = member.bootstrap()
        assert state['me']['mapVisibilityReviewed'] and not state['me']['shareLocation']
        member.call('map-visibility', {'mode': 'profile', **point})
        assert member.call('map-visibility', {'mode': 'hidden', 'reviewOnly': True})['mode'] == 'profile'
        state = member.bootstrap()
        assert state['me']['shareLocation'] and state['me']['discoverable']
        assert member.call('map-visibility', {'mode': 'profile'})['mode'] == 'profile'
        member.call('checkin', {'status': 'done', 'visibility': 'friends', 'nonce': secrets.token_hex(12)})
        params = urlencode({**point})
        assert any(item['isMe'] for item in member.call('nearby', point)['activity'])
        member.call('map-visibility', {'mode': 'hidden'})
        assert not member.call('location', {'enabled': True, 'refreshOnly': True, **point})['enabled']
        state = member.bootstrap()
        assert not state['me']['shareLocation'] and not state['me']['discoverable']
        assert not any(item['isMe'] for item in member.call('nearby', point)['activity'])
        print('PASS: First-review acknowledgement preserves actual consent; explicit profile visibility works, hiding removes own map activity, and a stale location refresh cannot republish it.', flush=True)

        cases = [
            ([0, 1, 2], 3, 1, 1, 3),
            ([2, 3, 4], 3, 0, 1, 3),
            ([3, 4, 5], 0, 0, 1, 3),
            ([0, 1, 2, 4, 5, 6], 6, 1, 1, 6),
            (list(range(21)), 21, 2, 2, 21),
            (list(range(3, 24)), 21, 0, 2, 21),
            (list(range(4, 25)), 0, 0, 2, 21),
        ]
        for days, current, charges, capacity, best in cases:
            fixture(member, 'streak-history', daysAgo=days)
            a = member.bootstrap()['stats']['streak']
            assert (a['current'], a['charges'], a['capacity'], a['best']) == (current, charges, capacity, best), (days, a)
            b = member.bootstrap()['stats']['streak']
            assert a == b, 'Reading a streak must not mint/consume charges again'
            if days == [2, 3, 4]: assert a['protectedYesterday'] and a['freezesUsed'] == 1
        print('PASS: Real SQL history awards the first freeze at three days, recharges after three active days, unlocks the second charge at 21, uses only available charges and waits until a missed day ends.', flush=True)

        fixture(member, 'streak-history', daysAgo=[0, 1, 2])
        for _ in range(4):
            member.call('checkin', {'status': 'done', 'visibility': 'private', 'nonce': secrets.token_hex(12)})
            state = member.call('checkin', {'status': 'need', 'visibility': 'private', 'nonce': secrets.token_hex(12)})
            assert state['stats']['streak']['current'] == 3
            assert state['stats']['streak']['charges'] == 1
        guest = client()
        guest.call('map-visibility', {'mode': 'profile'}, expected=401)
        state = guest.call('checkin', {'status': 'need', 'visibility': 'private', 'nonce': secrets.token_hex(12)})
        assert state['stats']['streak']['current'] == 0
        state = guest.call('checkin', {'status': 'done', 'visibility': 'private', 'nonce': secrets.token_hex(12)})
        assert state['stats']['streak']['current'] == 1 and state['stats']['streak']['charges'] == 0
        fixture(member, 'streak-history', daysAgo=list(range(60)))
        state=member.bootstrap();award=next(item for item in state['achievements'] if item['slug']=='streak')
        assert award['progress']==60 and award['level']==5 and award['next']==90
        assert award['title']=='دو ماهِ آفتابی' and len(award['levels'])==8
        print('PASS: Real achievements use the freeze-aware best streak and eight milestone thresholds through one year.',flush=True)
        print('PASS: Need/repeated same-day taps cannot inflate days or charges; private completed check-ins and free guest access still count.', flush=True)
    finally:
        for account in reversed(owned):
            if account.owned_id: account.call('delete-account', {})
        print('Removed owned QA accounts.', flush=True)


if __name__ == '__main__': main()
