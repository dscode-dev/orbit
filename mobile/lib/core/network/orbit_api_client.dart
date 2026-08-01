/// Cliente HTTP centralizado.
///
/// Único ponto do app que conhece a URL do backend e o formato do envelope.
/// Nenhum widget faz requisição: a UI chama providers, que chamam
/// repositories, que chamam este cliente.
///
/// O backend responde no envelope do `ResponseInterceptor`:
/// `{ success, data, requestId, timestamp }` — o cliente devolve `data` já
/// desembrulhado.
library;

import 'package:dio/dio.dart';

import '../config/environment.dart';
import '../errors/orbit_exception.dart';
import '../observability/orbit_logger.dart';
import '../storage/token_storage.dart';
import 'orbit_interceptors.dart';
import 'session_authenticator.dart';

class OrbitApiClient {
  OrbitApiClient._({required Dio dio, required this.authenticator})
    : _dio = dio;

  /// Monta o cliente com todos os interceptors na ordem correta.
  factory OrbitApiClient.create({
    required OrbitEnvironment environment,
    required TokenStorage storage,
    required OrbitLogger logger,
    String locale = 'pt-BR',
    String timezone = 'America/Recife',
    Dio? dio,
    Dio? retryDio,
  }) {
    BaseOptions options() => BaseOptions(
      baseUrl: environment.apiBaseUrl,
      connectTimeout: environment.connectTimeout,
      receiveTimeout: environment.receiveTimeout,
      contentType: Headers.jsonContentType,
      // O envelope de erro vem no corpo; deixamos o Dio entregar 4xx/5xx
      // para o mapeamento em vez de lançar antes de lermos a resposta.
      validateStatus: (status) => status != null && status < 400,
    );

    final client = dio ?? Dio(options());
    if (dio == null) client.options = options();

    // Cliente sem AuthInterceptor: usado para renovar e para reexecutar,
    // evitando recursão de interceptors.
    final plain = retryDio ?? Dio(options());
    if (retryDio == null) plain.options = options();

    final context = RequestContextInterceptor(
      locale: locale,
      timezone: timezone,
    );
    plain.interceptors.addAll([context, ErrorMappingInterceptor()]);

    final authenticator = SessionAuthenticator(
      storage: storage,
      logger: logger,
      refreshCall: (refreshToken) async {
        final response = await plain.post<dynamic>(
          '/identity/refresh',
          data: {'refreshToken': refreshToken},
        );
        final data = _unwrap(response.data);
        if (data is! Map<String, dynamic>) {
          throw const OrbitException(
            kind: OrbitErrorKind.parse,
            message: 'Resposta de renovação inválida.',
            code: 'PARSE',
          );
        }
        return TokenPair.fromJson(data);
      },
    );

    client.interceptors.addAll([
      context,
      AuthInterceptor(
        storage: storage,
        authenticator: authenticator,
        retryClient: plain,
      ),
      LoggingInterceptor(logger),
      ErrorMappingInterceptor(),
    ]);

    return OrbitApiClient._(dio: client, authenticator: authenticator);
  }

  final Dio _dio;
  final SessionAuthenticator authenticator;

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
    bool isPublic = false,
  }) => _send<T>(
    () => _dio.get<dynamic>(
      path,
      queryParameters: _clean(query),
      cancelToken: cancelToken,
      options: _options(isPublic),
    ),
  );

  Future<T> post<T>(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
    bool isPublic = false,
  }) => _send<T>(
    () => _dio.post<dynamic>(
      path,
      data: body,
      queryParameters: _clean(query),
      cancelToken: cancelToken,
      options: _options(isPublic),
    ),
  );

  Future<T> patch<T>(
    String path, {
    Object? body,
    CancelToken? cancelToken,
  }) => _send<T>(
    () => _dio.patch<dynamic>(path, data: body, cancelToken: cancelToken),
  );

  Future<T> delete<T>(String path, {CancelToken? cancelToken}) =>
      _send<T>(() => _dio.delete<dynamic>(path, cancelToken: cancelToken));

  /// Envia um arquivo em `multipart/form-data`.
  ///
  /// O backend recebe um arquivo por requisição, no campo `file`
  /// (`FileInterceptor('file')`). O progresso é reportado enquanto o corpo
  /// sobe — é o que alimenta a barra na tela.
  Future<T> upload<T>(
    String path, {
    required String filePath,
    required String fileName,
    required String mimeType,
    CancelToken? cancelToken,
    void Function(double progress)? onProgress,
  }) async {
    final form = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        filePath,
        filename: fileName,
        contentType: DioMediaType.parse(mimeType),
      ),
    });

    return _send<T>(
      () => _dio.post<dynamic>(
        path,
        data: form,
        cancelToken: cancelToken,
        onSendProgress: (sent, total) {
          if (total > 0) onProgress?.call(sent / total);
        },
      ),
    );
  }

  Options _options(bool isPublic) =>
      Options(extra: isPublic ? {publicRequestKey: true} : null);

  /// Remove chaves nulas ou vazias — o `ValidationPipe` do backend usa
  /// `forbidNonWhitelisted` e rejeita parâmetros vazios.
  Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) return null;
    final cleaned = <String, dynamic>{};
    query.forEach((key, value) {
      if (value == null) return;
      if (value is String && value.isEmpty) return;
      cleaned[key] = value;
    });
    return cleaned.isEmpty ? null : cleaned;
  }

  Future<T> _send<T>(Future<Response<dynamic>> Function() request) async {
    try {
      final response = await request();
      return _unwrap(response.data) as T;
    } on DioException catch (error) {
      final mapped = error.error;
      if (mapped is OrbitException) throw mapped;
      throw OrbitException(
        kind: OrbitErrorKind.network,
        message: error.message ?? 'Falha de comunicação.',
        code: 'NETWORK',
      );
    }
  }

  /// Extrai `data` do envelope; respostas sem envelope passam direto.
  static Object? _unwrap(Object? body) {
    if (body is Map<String, dynamic> &&
        body.containsKey('success') &&
        body.containsKey('data')) {
      return body['data'];
    }
    return body;
  }
}
