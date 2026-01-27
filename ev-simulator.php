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
    wp_enqueue_style('evsim-hc', $asset_url . 'assets/evsim-hc.css', [], '0.1.0');
    wp_enqueue_script('evsim-hc', $asset_url . 'assets/evsim-hc.js', [], '0.1.0', true);

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

    $render_select = function (string $id, string $default) use ($options): string {
        $html = sprintf('<select id="%s" class="evsim-hc__select">', esc_attr($id));
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
            <label class="evsim-hc__label" for="evsim-p1">Spielerkarte 1</label>
            <?php echo $render_select('evsim-p1', 'T'); ?>
        </div>
        <div class="evsim-hc__row">
            <label class="evsim-hc__label" for="evsim-p2">Spielerkarte 2</label>
            <?php echo $render_select('evsim-p2', '6'); ?>
        </div>
        <div class="evsim-hc__row">
            <label class="evsim-hc__label" for="evsim-d">Dealerkarte</label>
            <?php echo $render_select('evsim-d', 'T'); ?>
        </div>
        <button class="evsim-hc__btn" type="button">BERECHNE</button>
        <table class="evsim-hc__table">
            <tbody></tbody>
        </table>
    </div>
    <?php
    return ob_get_clean();
}

add_shortcode('ev_simulator_handcalc', 'evsimulator_render_handcalc_shortcode');
