CREATE TABLE `ngvt_phonehome` (
  `package_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `hostname` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `created_time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_updated` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `git_hash` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `ip_list` text CHARACTER SET ascii COLLATE ascii_general_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `ngvt_version` (
  `package_name` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `hostname_regex` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `match_priority` int(11) NOT NULL DEFAULT '0',
  `git_hash` varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `ngvt_phonehome`
  ADD PRIMARY KEY (`package_name`,`hostname`);

ALTER TABLE `ngvt_version`
  ADD PRIMARY KEY (`package_name`,`hostname_regex`);
