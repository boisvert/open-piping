<?php

// echo "testing the PHP interpreter ";
if (!isset($_POST["exp"])) die("No data");

$exp = $_POST["exp"];
echo $exp;

$json = file_get_contents('functions.json');
$funcs = json_decode($json);

print_r($funcs)

?>