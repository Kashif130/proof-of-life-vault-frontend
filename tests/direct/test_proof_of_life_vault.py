import pytest

from conftest import warp_to

GEN = 10**18

NOW = "2099-01-01T00:00:00Z"
DEFAULT_INTERVAL = 90 * 86400  # 90 days, within the 30-730 day bounds
AFTER_INTERVAL = "2099-04-01T00:00:01Z"  # > 90 days after NOW
JUST_BEFORE_INTERVAL = "2099-03-31T23:59:59Z"

# Contestation window is a fixed 30-day protocol constant, starting from whenever
# trigger_inheritance is actually called (AFTER_INTERVAL above).
AFTER_CONTESTATION = "2099-05-01T00:00:02Z"      # > 30 days after AFTER_INTERVAL
JUST_BEFORE_CONTESTATION = "2099-05-01T00:00:00Z"

AFTER_LIFE_SIGNAL_COOLDOWN = "2099-04-02T00:00:02Z"  # > 1 day after AFTER_INTERVAL

PUBLIC_DNS_ANSWER = '{"Status":0,"Answer":[{"type":1,"data":"93.184.216.34"}]}'
PRIVATE_DNS_ANSWER = '{"Status":0,"Answer":[{"type":1,"data":"169.254.169.254"}]}'

VALID_GITHUB = "https://github.com/octocat"
VALID_TWITTER = "https://x.com/octocat"
VALID_WEBSITE = "https://example.com/octocat"


def create_vault(contract, direct_vm, owner, beneficiaries=None, interval=DEFAULT_INTERVAL,
                  github="", twitter="", website=""):
    if beneficiaries is None:
        beneficiaries = [(None, 10000)]  # resolved to a default beneficiary by caller if needed
    direct_vm.sender = owner
    addrs = [b[0] for b in beneficiaries]
    bps = [b[1] for b in beneficiaries]
    contract.create_vault(interval, addrs, bps, github, twitter, website)


def mock_public_dns(direct_vm):
    direct_vm.mock_web(r".*dns\.google/resolve.*", {"status": 200, "body": PUBLIC_DNS_ANSWER})


def mock_life_signal(direct_vm, github="NOT_APPLICABLE", twitter="NOT_APPLICABLE",
                      website="NOT_APPLICABLE", reason="Evidence reviewed."):
    direct_vm.clear_mocks()
    mock_public_dns(direct_vm)
    direct_vm.mock_web(r".*api\.github\.com/users/.*/events/public",
                        {"status": 200, "body": '[{"type":"PushEvent","created_at":"2099-04-15T00:00:00Z"}]'})
    direct_vm.mock_web(r"https://x\.com/.*", {"status": 200, "body": "profile page text, recent post visible"})
    direct_vm.mock_web(r"https://example\.com/.*", {"status": 200, "body": "personal site, last updated recently"})
    direct_vm.mock_llm(
        r".*checking three possible public evidence sources.*",
        f'{{"github_result":"{github}","twitter_result":"{twitter}",'
        f'"website_result":"{website}","rationale":"{reason}"}}',
    )


# --- vault creation ---

def test_create_vault(contract, direct_vm, direct_bob, direct_carol):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    v = contract.get_vault(direct_bob)
    assert v["status"] == "ACTIVE"
    assert v["beneficiary_count"] == 1
    assert v["last_check_in_at"] == NOW


def test_create_vault_twice_fails(contract, direct_vm, direct_bob, direct_carol):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    with pytest.raises(Exception):
        create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])


def test_create_vault_rejects_interval_too_short(contract, direct_vm, direct_bob, direct_carol):
    with pytest.raises(Exception):
        create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)], interval=86400)


def test_create_vault_rejects_interval_too_long(contract, direct_vm, direct_bob, direct_carol):
    with pytest.raises(Exception):
        create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)],
                      interval=800 * 86400)


def test_create_vault_rejects_bps_not_summing_to_10000(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    with pytest.raises(Exception):
        create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 5000), (direct_dave, 4000)])


def test_create_vault_rejects_duplicate_beneficiary(contract, direct_vm, direct_bob, direct_carol):
    with pytest.raises(Exception):
        create_vault(contract, direct_vm, direct_bob,
                      beneficiaries=[(direct_carol, 5000), (direct_carol, 5000)])


def test_create_vault_rejects_zero_bps(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    with pytest.raises(Exception):
        create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 0), (direct_dave, 10000)])


def test_create_vault_rejects_too_many_beneficiaries(contract, direct_vm, direct_bob, direct_carol):
    beneficiaries = [(direct_carol, 1000)] * 10 + [(direct_carol, 0)]
    with pytest.raises(Exception):
        create_vault(contract, direct_vm, direct_bob, beneficiaries=beneficiaries)


def test_create_vault_rejects_non_github_domain(contract, direct_vm, direct_bob, direct_carol):
    with pytest.raises(Exception):
        create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)],
                      github="https://gitlab.com/octocat")


def test_create_vault_rejects_private_website_url(contract, direct_vm, direct_bob, direct_carol):
    with pytest.raises(Exception):
        create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)],
                      website="https://169.254.169.254/evidence")


def test_create_vault_accepts_empty_life_signal_urls(contract, direct_vm, direct_bob, direct_carol):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    v = contract.get_vault(direct_bob)
    assert v["github_url"] == ""


# --- funding ---

def test_deposit_increases_balance(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_dave
    direct_vm.value = 5 * GEN
    contract.deposit(direct_bob)
    direct_vm.value = 0
    assert contract.get_vault(direct_bob)["balance"] == str(5 * GEN)


def test_deposit_rejects_zero(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_dave
    direct_vm.value = 0
    with pytest.raises(Exception):
        contract.deposit(direct_bob)


def test_deposit_requires_existing_vault(contract, direct_vm, direct_bob):
    direct_vm.sender = direct_bob
    direct_vm.value = 1 * GEN
    with pytest.raises(Exception):
        contract.deposit(direct_bob)
    direct_vm.value = 0


def test_owner_withdraw(contract, direct_vm, direct_bob, direct_carol):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_bob
    direct_vm.value = 5 * GEN
    contract.deposit(direct_bob)
    direct_vm.value = 0
    contract.owner_withdraw(2 * GEN)
    assert contract.get_vault(direct_bob)["balance"] == str(3 * GEN)


def test_owner_withdraw_rejects_non_owner(contract, direct_vm, direct_bob, direct_carol):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_bob
    direct_vm.value = 5 * GEN
    contract.deposit(direct_bob)
    direct_vm.value = 0
    direct_vm.sender = direct_carol
    with pytest.raises(Exception):
        contract.owner_withdraw(1 * GEN)


def test_owner_withdraw_rejects_amount_over_balance(contract, direct_vm, direct_bob, direct_carol):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_bob
    with pytest.raises(Exception):
        contract.owner_withdraw(1 * GEN)


# --- beneficiary / config updates ---

def test_update_beneficiaries_while_active(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_bob
    contract.update_beneficiaries([direct_carol, direct_dave], [6000, 4000])
    b = contract.get_beneficiaries(direct_bob)
    assert len(b) == 2
    assert {x["address"]: x["bps"] for x in b} == {str(direct_carol): 6000, str(direct_dave): 4000}


def test_update_beneficiaries_requires_owner(contract, direct_vm, direct_bob, direct_carol):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_carol
    with pytest.raises(Exception):
        contract.update_beneficiaries([direct_carol], [10000])


def test_update_life_signals_while_active(contract, direct_vm, direct_bob, direct_carol):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_bob
    contract.update_life_signals(VALID_GITHUB, "", "")
    assert contract.get_vault(direct_bob)["github_url"] == VALID_GITHUB


def test_update_check_in_interval_while_active(contract, direct_vm, direct_bob, direct_carol):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_bob
    contract.update_check_in_interval(60 * 86400)
    assert contract.get_vault(direct_bob)["check_in_interval_seconds"] == 60 * 86400


# --- check-in ---

def test_check_in_updates_timestamp(contract, direct_vm, direct_bob, direct_carol):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    warp_to(direct_vm, "2099-02-01T00:00:00Z")
    direct_vm.sender = direct_bob
    contract.check_in(direct_bob)
    assert contract.get_vault(direct_bob)["last_check_in_at"] == "2099-02-01T00:00:00Z"


def test_check_in_rejects_stranger(contract, direct_vm, direct_bob, direct_carol):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_carol
    with pytest.raises(Exception):
        contract.check_in(direct_bob)


def test_check_in_cancels_trigger(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)
    assert contract.get_vault(direct_bob)["status"] == "TRIGGERED"

    direct_vm.sender = direct_bob
    contract.check_in(direct_bob)
    v = contract.get_vault(direct_bob)
    assert v["status"] == "ACTIVE"
    assert v["triggered_at"] == ""
    assert v["contestation_deadline"] == ""


def test_backup_signer_can_check_in(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_bob
    contract.update_backup_signer(direct_dave, True)
    direct_vm.sender = direct_dave
    contract.check_in(direct_bob)  # should not raise


def test_disabled_backup_signer_cannot_check_in(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_bob
    contract.update_backup_signer(direct_dave, True)
    contract.update_backup_signer(direct_dave, False)
    direct_vm.sender = direct_dave
    with pytest.raises(Exception):
        contract.check_in(direct_bob)


# --- trigger ---

def test_trigger_before_interval_elapsed_fails(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    warp_to(direct_vm, JUST_BEFORE_INTERVAL)
    direct_vm.sender = direct_dave
    with pytest.raises(Exception):
        contract.trigger_inheritance(direct_bob)


def test_trigger_after_interval_elapsed_succeeds(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)
    v = contract.get_vault(direct_bob)
    assert v["status"] == "TRIGGERED"
    assert v["triggered_at"] == AFTER_INTERVAL


def test_trigger_pays_keeper_reward_from_vault_balance(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    direct_vm.sender = direct_bob
    direct_vm.value = 1 * GEN
    contract.deposit(direct_bob)
    direct_vm.value = 0
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)
    assert contract.get_vault(direct_bob)["balance"] == str(1 * GEN - 2 * 10**14)


def test_trigger_on_already_triggered_vault_fails(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)
    with pytest.raises(Exception):
        contract.trigger_inheritance(direct_bob)


# --- life-signal check ---

def test_life_signal_check_requires_triggered_status(contract, direct_vm, direct_bob, direct_carol):
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)], github=VALID_GITHUB)
    with pytest.raises(Exception):
        contract.run_life_signal_check(direct_bob)


def test_life_signal_check_requires_registered_urls(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)
    with pytest.raises(Exception):
        contract.run_life_signal_check(direct_bob)


def test_life_signal_check_finds_activity_and_cancels_trigger(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)], github=VALID_GITHUB)
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)

    mock_life_signal(direct_vm, github="ACTIVITY_AFTER_CHECKIN")
    contract.run_life_signal_check(direct_bob)
    v = contract.get_vault(direct_bob)
    assert v["status"] == "ACTIVE"
    assert v["life_signal_verdict"] == "RECENT_ACTIVITY_FOUND"
    assert v["last_check_in_at"] == AFTER_INTERVAL


def test_life_signal_check_no_activity_leaves_trigger_running(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)], github=VALID_GITHUB)
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)

    mock_life_signal(direct_vm, github="NO_ACTIVITY_AFTER_CHECKIN")
    contract.run_life_signal_check(direct_bob)
    v = contract.get_vault(direct_bob)
    assert v["status"] == "TRIGGERED"
    assert v["life_signal_verdict"] == "NO_RECENT_ACTIVITY"


def test_life_signal_check_one_source_undetermined_is_insufficient_not_negative(
    contract, direct_vm, direct_bob, direct_carol, direct_dave
):
    """Asymmetric aggregation: github says no activity, but twitter could not be determined --
    the overall verdict must be INSUFFICIENT_EVIDENCE, never a confident NO_RECENT_ACTIVITY,
    since a false negative here is the dangerous direction of error."""
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)],
                 github=VALID_GITHUB, twitter=VALID_TWITTER)
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)

    mock_life_signal(direct_vm, github="NO_ACTIVITY_AFTER_CHECKIN", twitter="COULD_NOT_DETERMINE")
    contract.run_life_signal_check(direct_bob)
    v = contract.get_vault(direct_bob)
    assert v["status"] == "TRIGGERED"
    assert v["life_signal_verdict"] == "INSUFFICIENT_EVIDENCE"


def test_life_signal_check_any_single_source_activity_wins(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    """Github shows no activity, twitter shows activity -- one positive source is enough to
    conclude the person is likely alive."""
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)],
                 github=VALID_GITHUB, twitter=VALID_TWITTER)
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)

    mock_life_signal(direct_vm, github="NO_ACTIVITY_AFTER_CHECKIN", twitter="ACTIVITY_AFTER_CHECKIN")
    contract.run_life_signal_check(direct_bob)
    assert contract.get_vault(direct_bob)["status"] == "ACTIVE"


def test_life_signal_check_requires_cooldown(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)], github=VALID_GITHUB)
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)
    mock_life_signal(direct_vm, github="NO_ACTIVITY_AFTER_CHECKIN")
    contract.run_life_signal_check(direct_bob)
    with pytest.raises(Exception):
        contract.run_life_signal_check(direct_bob)


def test_life_signal_check_after_cooldown_can_retry(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)], github=VALID_GITHUB)
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)
    mock_life_signal(direct_vm, github="NO_ACTIVITY_AFTER_CHECKIN")
    contract.run_life_signal_check(direct_bob)
    warp_to(direct_vm, AFTER_LIFE_SIGNAL_COOLDOWN)
    mock_life_signal(direct_vm, github="ACTIVITY_AFTER_CHECKIN")
    contract.run_life_signal_check(direct_bob)
    assert contract.get_vault(direct_bob)["status"] == "ACTIVE"


def test_life_signal_check_blocks_hostname_resolving_to_private_ip(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)], website=VALID_WEBSITE)
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)

    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*dns\.google/resolve.*", {"status": 200, "body": PRIVATE_DNS_ANSWER})
    direct_vm.mock_web(r"https://example\.com/.*", {"status": 200, "body": "site text"})
    direct_vm.mock_llm(
        r".*checking three possible public evidence sources.*",
        '{"github_result":"NOT_APPLICABLE","twitter_result":"NOT_APPLICABLE",'
        '"website_result":"ACTIVITY_AFTER_CHECKIN","rationale":"looks active"}',
    )
    contract.run_life_signal_check(direct_bob)
    v = contract.get_vault(direct_bob)
    # website fetch was blocked before ever reaching the LLM's (irrelevant) claim of activity
    assert v["status"] == "TRIGGERED"
    assert v["life_signal_verdict"] == "INSUFFICIENT_EVIDENCE"


# --- finalize ---

def test_finalize_before_contestation_elapsed_fails(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    create_vault(contract, direct_vm, direct_bob, beneficiaries=[(direct_carol, 10000)])
    warp_to(direct_vm, AFTER_INTERVAL)
    direct_vm.sender = direct_dave
    contract.trigger_inheritance(direct_bob)
    warp_to(direct_vm, JUST_BEFORE_CONTESTATION)
    with pytest.raises(Exception):
        contract.finalize_inheritance(direct_bob)


def test_finalize_after_contestation_elapsed_succeeds(contract, direct_vm, direct_bob, direct_carol, direct_dave):
    warp_to(direct_vm, NOW)
    crea
