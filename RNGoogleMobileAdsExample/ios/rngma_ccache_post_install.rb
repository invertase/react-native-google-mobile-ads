# frozen_string_literal: true

# Wire Xcode CC/CXX to repo-owned ccache wrappers without touching LD/LDPLUSPLUS
# (Xcode 27 trap) and without RN's CCACHE_BINARY build-setting scripts
# (facebook/react-native#58066 — Xcode does not export that setting into the
# wrapper env, so RN's scripts silently fall back to plain clang).
#
# RNTA accepts `:ccache_enabled => true` on use_test_app! but does not forward
# it to react_native_post_install; this helper is the supported path for the
# example app.

module RngmaCcache
  module_function

  def wrapper_dir
    File.join(__dir__, 'ccache')
  end

  def clang_wrapper
    File.join(wrapper_dir, 'ccache-clang.sh')
  end

  def clangpp_wrapper
    File.join(wrapper_dir, 'ccache-clang++.sh')
  end

  def apply_compiler_settings!(installer)
    unless File.executable?(clang_wrapper) && File.executable?(clangpp_wrapper)
      Pod::UI.warn(
        "[RngmaCcache]: wrappers missing or not executable under #{wrapper_dir}",
      )
      return
    end

    projects = [installer.pods_project]
    installer.aggregate_targets.each do |aggregate_target|
      user_project = aggregate_target.user_project
      projects << user_project unless user_project.nil?
    end
    projects.uniq!

    projects.each do |project|
      project.build_configurations.each do |config|
        settings = config.build_settings
        settings['CC'] = clang_wrapper
        settings['CXX'] = clangpp_wrapper
        # Never route the linker through a clang/ccache wrapper.
        settings.delete('LD')
        settings.delete('LDPLUSPLUS')
        settings.delete('CCACHE_BINARY')
      end
      project.save
    end

    Pod::UI.puts(
      "[RngmaCcache]: CC/CXX → #{clang_wrapper} / #{clangpp_wrapper} " \
      '(LD/LDPLUSPLUS cleared)',
    )
  end
end
