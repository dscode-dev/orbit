/// Configuração de ambiente.
///
/// Os valores chegam por `--dart-define`, nunca por arquivo versionado — a URL
/// da API muda entre local, homologação e produção e não deve virar constante
/// de código.
///
/// ```sh
/// flutter run --dart-define=ORBIT_API_URL=http://10.0.2.2:6001/api/v1
/// flutter build apk --dart-define=ORBIT_API_URL=https://api.orbit.app/api/v1
/// ```
library;

enum OrbitFlavor { development, staging, production }

class OrbitEnvironment {
  const OrbitEnvironment({
    required this.apiBaseUrl,
    required this.flavor,
    required this.connectTimeout,
    required this.receiveTimeout,
  });

  /// Lê a configuração do processo.
  ///
  /// O padrão aponta para `10.0.2.2`, que é como o emulador Android enxerga o
  /// `localhost` da máquina — o valor mais útil em desenvolvimento.
  ///
  /// A porta é a que o compose **publica** (`API_PORT`), não a `5001` que a
  /// API escuta dentro do container. Apontar para a interna dá "connection
  /// refused" sem nenhuma pista no app.
  factory OrbitEnvironment.fromDefines() {
    const url = String.fromEnvironment(
      'ORBIT_API_URL',
      defaultValue: 'http://10.0.2.2:6001/api/v1',
    );
    const flavorName = String.fromEnvironment(
      'ORBIT_FLAVOR',
      defaultValue: 'development',
    );
    return OrbitEnvironment(
      apiBaseUrl: url,
      flavor: OrbitFlavor.values.firstWhere(
        (value) => value.name == flavorName,
        orElse: () => OrbitFlavor.development,
      ),
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
    );
  }

  /// URL do NestJS. O app fala direto com a API — o BFF é da aplicação web.
  final String apiBaseUrl;
  final OrbitFlavor flavor;
  final Duration connectTimeout;
  final Duration receiveTimeout;

  bool get isProduction => flavor == OrbitFlavor.production;

  /// O destino, como `192.168.1.233:6001`.
  ///
  /// Serve para o app **dizer para onde tentou ir** quando a conexão falha.
  /// Uma tela que só informa "sem conexão" esconde justamente o fato que
  /// resolve o problema: quase sempre a URL é a errada, não a rede.
  String get apiHost {
    final uri = Uri.tryParse(apiBaseUrl);
    if (uri == null || uri.host.isEmpty) return apiBaseUrl;
    return uri.hasPort ? '${uri.host}:${uri.port}' : uri.host;
  }

  /// Fora de produção o endereço aparece na mensagem de erro.
  ///
  /// Em produção não: o endereço do servidor não é assunto de quem usa o app,
  /// e a mensagem genérica continua sendo a certa.
  String? get diagnosticHost => isProduction ? null : apiHost;

  /// Cliente informado ao backend em `LoginDto.client`.
  static const String client = 'MOBILE';
}
