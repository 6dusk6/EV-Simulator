<?php
/**
 * Plugin Name: EV-Simulator
 * Description: Blackjack Hand EV Calculator
 * Version: 0.1.0
 * Author: blackjack-21.de
 * Requires at least: 6.9
 * Requires PHP: 8.3
 */

if (!defined('ABSPATH')) {
    exit;
}

function evsimulator_render_handcalc_shortcode(): string
{
    $asset_url = plugin_dir_url(__FILE__);
    $style_path = plugin_dir_path(__FILE__) . 'assets/evsim-hc.css';
    $script_path = plugin_dir_path(__FILE__) . 'assets/evsim-hc.js';
    $style_version = (string) filemtime($style_path);
    $script_version = (string) filemtime($script_path);

    wp_enqueue_style('evsim-hc', $asset_url . 'assets/evsim-hc.css', [], $style_version);
    wp_enqueue_script('evsim-hc', $asset_url . 'assets/evsim-hc.js', [], $script_version, true);

    $options = [
        ['value' => '2', 'label' => '2'],
        ['value' => '3', 'label' => '3'],
        ['value' => '4', 'label' => '4'],
        ['value' => '5', 'label' => '5'],
        ['value' => '6', 'label' => '6'],
        ['value' => '7', 'label' => '7'],
        ['value' => '8', 'label' => '8'],
        ['value' => '9', 'label' => '9'],
        ['value' => 'T', 'label' => '10'],
        ['value' => 'A', 'label' => 'A'],
    ];

    $render_select = function (string $id, string $default, string $extra_class = '') use ($options): string {
        $classes = trim('evsim-hc__select ' . $extra_class);
        $html = sprintf('<select id="%s" class="%s">', esc_attr($id), esc_attr($classes));

        foreach ($options as $option) {
            $selected = $option['value'] === $default ? ' selected' : '';
            $html .= sprintf(
                '<option value="%s"%s>%s</option>',
                esc_attr($option['value']),
                $selected,
                esc_html($option['label'])
            );
        }

        $html .= '</select>';
        return $html;
    };

    ob_start();
    ?>
    <div class="evsim-hc">
        <div class="evsim-hc__row">
            <label class="evsim-hc__label" for="evsim-p1">Spielerkarte 1:</label>
            <?php echo $render_select('evsim-p1', 'T', 'evsim-hc__select--card'); ?>
        </div>
        <div class="evsim-hc__row">
            <label class="evsim-hc__label" for="evsim-p2">Spielerkarte 2:</label>
            <?php echo $render_select('evsim-p2', '6', 'evsim-hc__select--card'); ?>
        </div>
        <div class="evsim-hc__row">
            <label class="evsim-hc__label" for="evsim-d">Dealerkarte:</label>
            <?php echo $render_select('evsim-d', 'T', 'evsim-hc__select--card'); ?>
        </div>
        <div class="evsim-hc__summary"></div>
        <button class="evsim-hc__btn" type="button">BERECHNEN</button>
        <table class="evsim-hc__table">
            <tbody></tbody>
        </table>
    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('ev_simulator_handcalc', 'evsimulator_render_handcalc_shortcode');
