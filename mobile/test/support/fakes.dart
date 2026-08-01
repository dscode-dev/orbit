/// Dublês usados nos testes.
///
/// Substituem apenas infraestrutura (armazenamento e transporte). Os contratos
/// e as regras exercitadas são os reais.
library;

import 'dart:convert';

import 'package:orbit_operator/core/storage/read_cache.dart';
import 'package:orbit_operator/core/storage/token_storage.dart';

/// Armazenamento em memória, com contagem de escritas.
class InMemoryTokenStorage implements TokenStorage {
  InMemoryTokenStorage([this._tokens]);

  TokenPair? _tokens;
  int writes = 0;
  int clears = 0;

  @override
  Future<TokenPair?> read() async => _tokens;

  @override
  Future<void> write(TokenPair tokens) async {
    _tokens = tokens;
    writes++;
  }

  @override
  Future<void> clear() async {
    _tokens = null;
    clears++;
  }
}

class InMemoryReadCache implements ReadCache {
  final Map<String, CachedValue<Map<String, dynamic>>> entries = {};

  @override
  Future<CachedValue<Map<String, dynamic>>?> read(String key) async =>
      entries[key];

  @override
  Future<void> write(String key, Map<String, dynamic> value) async {
    entries[key] = CachedValue(value: value, cachedAt: DateTime.now());
  }

  @override
  Future<void> clear() async => entries.clear();
}

/// Gera um access token com as claims informadas.
///
/// A assinatura é irrelevante: o app só decodifica o payload — quem verifica
/// é o backend.
String fakeAccessToken({
  String userId = 'user-1',
  String sessionId = 'session-1',
  String? organizationId = 'org-1',
  String? businessUnitId = 'unit-1',
  List<String> roles = const ['OWNER'],
  List<String> permissions = const ['*'],
  DateTime? expiresAt,
}) {
  String segment(Map<String, dynamic> value) =>
      base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');

  return '${segment({'alg': 'HS256'})}.'
      '${segment({
        'sub': userId,
        'sid': sessionId,
        'organizationId': organizationId,
        'businessUnitId': businessUnitId,
        'businessUnitIds': [if (businessUnitId != null) businessUnitId],
        'roles': roles,
        'permissions': permissions,
        'type': 'access',
        if (expiresAt != null) 'exp': expiresAt.millisecondsSinceEpoch ~/ 1000,
      })}.assinatura';
}

/// Envelope de sucesso do backend (`ResponseInterceptor`).
Map<String, dynamic> envelope(Object? data) => {
  'success': true,
  'data': data,
  'requestId': 'req-teste',
  'timestamp': '2026-08-01T12:00:00.000Z',
};

/// Envelope de erro do backend (`FoundationExceptionFilter`).
Map<String, dynamic> errorEnvelope({
  required String code,
  required String message,
}) => {
  'success': false,
  'error': {'code': code, 'message': message},
  'requestId': 'req-teste',
  'timestamp': '2026-08-01T12:00:00.000Z',
};
