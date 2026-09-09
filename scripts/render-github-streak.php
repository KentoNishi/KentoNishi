<?php

declare(strict_types=1);

if ($argc !== 3) {
    throw new InvalidArgumentException("usage: php render-github-streak.php <renderer-dir> <output-path>");
}

$renderer = realpath($argv[1]);
$output = $argv[2];
$timezone = new DateTimeZone("America/New_York");
date_default_timezone_set($timezone->getName());
$day = getenv("CARD_AS_OF_DATE");
$cutoff = DateTimeImmutable::createFromFormat("!Y-m-d", $day ?: "", $timezone);
if (!$cutoff || $cutoff->format("Y-m-d") !== $day) {
    throw new InvalidArgumentException("CARD_AS_OF_DATE must be a valid YYYY-MM-DD date");
}
$cutoff = $cutoff->setTime(23, 59, 59);
$_SERVER["TOKEN"] = getenv("TOKEN") ?: "";
if (!$_SERVER["TOKEN"] || !$renderer) {
    throw new InvalidArgumentException("TOKEN and a renderer directory are required");
}

chdir("$renderer/src");
require_once "$renderer/vendor/autoload.php";
require_once "$renderer/src/stats.php";
require_once "$renderer/src/card.php";

$graphs = getContributionGraphs("KentoNishi");
$currentYear = intval(date("Y"));
$created = $graphs[$currentYear]->data->user->createdAt ?? null;
if (!$created) {
    throw new RuntimeException("Missing GitHub account creation date");
}
for ($year = intval(substr($created, 0, 4)); $year <= intval($cutoff->format("Y")); $year++) {
    if (!isset($graphs[$year]) || !empty($graphs[$year]->errors)) {
        throw new RuntimeException("Missing or invalid contribution year $year");
    }
}

$dates = getContributionDates($graphs, $timezone->getName(), $cutoff);
// Upstream can include tomorrow's activity; this card ends at the completed Eastern day.
$dates = array_filter($dates, fn ($date) => $date <= $day, ARRAY_FILTER_USE_KEY);
if (empty($dates) || array_key_last($dates) !== $day) {
    throw new RuntimeException("Contribution calendar does not reach $day");
}
$stats = getContributionStats($dates);
// Yesterday is complete, so upstream's grace period for today does not apply.
if ($dates[$day] === 0) {
    $stats["currentStreak"] = ["start" => $day, "end" => $day, "length" => 0];
}
$svg = generateCard($stats, ["theme" => "dark", "hide_border" => "true"]);
if (file_put_contents($output, $svg) === false) {
    throw new RuntimeException("Could not write $output");
}
echo json_encode(["as_of_date" => $day, "stats" => $stats], JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . "\n";
