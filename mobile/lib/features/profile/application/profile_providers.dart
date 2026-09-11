/// Editar os próprios dados.
library;

import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/providers.dart';
import '../data/profile_repository.dart';

final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ProfileRepository(client: ref.watch(apiClientProvider)),
);

/// O que está acontecendo com a edição.
///
/// `AsyncValue<void>` e não um booleano: a folha precisa distinguir "salvando"
/// de "falhou", e um `bool salvando` obriga a carregar o erro num segundo
/// campo que alguém esquece de limpar.
class ProfileEditController extends StateNotifier<AsyncValue<void>> {
  ProfileEditController(this._ref) : super(const AsyncValue.data(null));

  final Ref _ref;

  /// Salva e **aplica na sessão**.
  ///
  /// Sem o segundo passo a pessoa salva, fecha a folha e continua vendo o
  /// nome antigo no topo — e conclui que não salvou.
  Future<bool> save({
    required String displayName,
    String? firstName,
    String? lastName,
    String? phone,
  }) async {
    state = const AsyncValue.loading();
    try {
      final user = await _ref
          .read(profileRepositoryProvider)
          .update(
            displayName: displayName,
            firstName: firstName,
            lastName: lastName,
            phone: phone,
          );
      _ref.read(authControllerProvider.notifier).applyUser(user);
      /// `mounted` antes de escrever: o provedor é `autoDispose`, e a folha
      /// pode ter sido fechada enquanto a requisição estava no ar.
      if (mounted) state = const AsyncValue.data(null);
      return true;
    } on Object catch (error, stack) {
      if (mounted) state = AsyncValue.error(error, stack);
      return false;
    }
  }

  /// Troca a foto: reserva, envia os bytes, ativa.
  ///
  /// Os três passos são um só para quem chama — uma falha no meio deixa um
  /// objeto órfão no armazenamento, e é o servidor que o recolhe. O que não
  /// pode acontecer é a foto aparecer pela metade na tela.
  Future<bool> changePhoto({
    required Uint8List bytes,
    required String fileName,
    required String mimeType,
  }) async {
    state = const AsyncValue.loading();
    try {
      final repository = _ref.read(profileRepositoryProvider);
      final ticket = await repository.reserveAvatar(
        fileName: fileName,
        mimeType: mimeType,
        sizeBytes: bytes.length,
      );
      await repository.putAvatarBytes(
        ticket: ticket,
        bytes: bytes,
        mimeType: mimeType,
      );
      await repository.activateAvatar(ticket.storageObjectId);

      /// O endereço da foto é assinado e temporário, e não vem no `PUT`.
      /// Recompor a sessão é o caminho que já sabe buscá-lo.
      await _ref.read(authControllerProvider.notifier).refreshProfile();
      /// `mounted` antes de escrever: o provedor é `autoDispose`, e a folha
      /// pode ter sido fechada enquanto a requisição estava no ar.
      if (mounted) state = const AsyncValue.data(null);
      return true;
    } on Object catch (error, stack) {
      if (mounted) state = AsyncValue.error(error, stack);
      return false;
    }
  }

  Future<bool> removePhoto() async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(profileRepositoryProvider).removeAvatar();
      await _ref.read(authControllerProvider.notifier).refreshProfile();
      /// `mounted` antes de escrever: o provedor é `autoDispose`, e a folha
      /// pode ter sido fechada enquanto a requisição estava no ar.
      if (mounted) state = const AsyncValue.data(null);
      return true;
    } on Object catch (error, stack) {
      if (mounted) state = AsyncValue.error(error, stack);
      return false;
    }
  }
}

final profileEditControllerProvider =
    StateNotifierProvider.autoDispose<ProfileEditController, AsyncValue<void>>(
      ProfileEditController.new,
    );
