cmake_minimum_required(VERSION 3.24)

project(ZeusEditor VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Qt6 6.5 REQUIRED COMPONENTS Core Gui Widgets WebEngineWidgets Network)

qt_standard_project_setup()

qt_add_executable(zeus-editor
  src/main.cpp
  src/MainWindow.cpp
  src/MainWindow.h
  src/Profile.cpp
  src/Profile.h
  src/SshRunner.cpp
  src/SshRunner.h
  src/TerminalWidget.cpp
  src/TerminalWidget.h
)

target_link_libraries(zeus-editor PRIVATE
  Qt6::Core
  Qt6::Gui
  Qt6::Widgets
  Qt6::WebEngineWidgets
  Qt6::Network
)

target_compile_definitions(zeus-editor PRIVATE
  ZEUS_EDITOR_SOURCE_ROOT="${CMAKE_SOURCE_DIR}/../.."
)

set_target_properties(zeus-editor PROPERTIES
  WIN32_EXECUTABLE TRUE
  MACOSX_BUNDLE FALSE
)

install(TARGETS zeus-editor
  BUNDLE DESTINATION .
  RUNTIME DESTINATION bin
)

qt_generate_deploy_app_script(
  TARGET zeus-editor
  OUTPUT_SCRIPT deploy_script
  NO_UNSUPPORTED_PLATFORM_ERROR
)
install(SCRIPT ${deploy_script})
