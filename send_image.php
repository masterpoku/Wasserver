<?php

// Mengecek apakah argumen sudah diberikan
if ($argc != 2) {
    echo "Usage: php send_image.php <to>\n";
    exit(1);
}

// Mengambil argumen dari command line
$to = $argv[1];
$text = "Ini adalah caption untuk gambar"; // Teks atau caption tetap
$imageUrl = "https://sampah.cloudside.id/images/737068226678d131.png"; // URL gambar tetap

// Membangun payload JSON
$data = json_encode([
    'to' => $to,
    'text' => $text,
    'imageUrl' => $imageUrl
]);

$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, 'http://147.139.201.32:60000/send-image');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $data);

$headers = [
    'Accept: */*',
    'User-Agent: Thunder Client (https://www.thunderclient.com)',
    'Content-Type: application/json'
];
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

$result = curl_exec($ch);

if (curl_errno($ch)) {
    echo 'Error: ' . curl_error($ch) . "\n";
} else {
    echo 'Response: ' . $result . "\n";
}

curl_close($ch);

